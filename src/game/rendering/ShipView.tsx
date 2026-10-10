/**
 * The interactive ship. One Skia canvas:
 *   - a cached SkPicture of the static ship (re-recorded only when its signature changes)
 *   - animated overlays (reactor pulse, anomalies, echoes, crew markers, selection, ghost)
 * Camera state lives in Reanimated shared values driven by gestures on the UI thread; taps are
 * hit-tested on the JS thread through the central iso/camera helpers.
 */
import {

  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Image,
  Path,
  Picture,
  RadialGradient,
  useClock,
  vec,
} from '@shopify/react-native-skia';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useReducedMotion, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

import { clampCamera, clampScale, fitCamera, screenToWorld } from '../camera/camera';
import { footprint } from '../content/modules';
import { gridBounds, hitTest, worldToGrid, type HitBox } from '../coordinates/iso';
import type { GameState, ModuleType, Rotation } from '../engine/types';
import { useSettings } from '../../state/settingsStore';
import { colors } from '../../theme/tokens';
import { echoOnModule } from '../systems/echo';
import { P } from './drawKit';
import { anomalyGeo, CREW_COLOR, ghostGeo, moduleGeo, overlayColor, overlaySignature, statusColor, type OverlayMode } from './overlayGeometry';
import { pictureRect, pictureSignature, rasterizeShip, recordShipPicture, WALL, type ShipPath } from './shipPicture';

export interface ShipViewHandle {
  focusModule: (id: string) => void;
  focusType: (type: ModuleType) => void;
  fit: () => void;
}

interface Props {
  state: GameState;
  path: ShipPath;
  selectedId?: string | null;
  ghost?: { type: ModuleType; x: number; y: number; rotation: Rotation } | null;
  overlay?: OverlayMode;
  hintType?: ModuleType | null;
  interactive?: boolean;
  insets?: { top: number; bottom: number; left: number; right: number };
  onSelect?: (id: string | null) => void;
  onLongPress?: (id: string) => void;
  onGhostMove?: (x: number, y: number) => void;
}

export const ShipView = forwardRef<ShipViewHandle, Props>(function ShipView(
  { state, path, selectedId = null, ghost = null, overlay = 'none', hintType = null, interactive = true, insets = { top: 0, bottom: 0, left: 0, right: 0 }, onSelect, onLongPress, onGhostMove },
  ref,
) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const ghostMode = useSharedValue(false);
  const start = useSharedValue({ tx: 0, ty: 0, scale: 1, fx: 0, fy: 0 });
  const vw = useSharedValue(0);
  const vh = useSharedValue(0);

  const bounds = useMemo(() => gridBounds(state.grid.width, state.grid.height, WALL + 50), [state.grid.width, state.grid.height]);
  const boundsSV = useSharedValue(bounds);
  useEffect(() => {
    boundsSV.value = bounds;
  }, [bounds, boundsSV]);
  useEffect(() => {
    ghostMode.value = !!ghost;
  }, [ghost, ghostMode]);

  // Frame the rooms that exist (their projected corners plus a margin), not the whole empty hull.
  const roomBounds = useMemo(() => {
    const mods = Object.values(state.modules);
    if (!mods.length) return bounds;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const m of mods) {
      const f = footprint(m.type, m.rotation);
      for (const [gx, gy] of [[m.x, m.y], [m.x + f.w, m.y], [m.x, m.y + f.h], [m.x + f.w, m.y + f.h]]) {
        const w = P(gx, gy, 0);
        left = Math.min(left, w.x);
        right = Math.max(right, w.x);
        bottom = Math.max(bottom, w.y + 14);
        top = Math.min(top, w.y - WALL - 18);
      }
    }
    const pad = 24;
    return { left: left - pad, right: right + pad, top: top - pad, bottom: bottom + pad, width: right - left + pad * 2, height: bottom - top + pad * 2 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.layoutVersion, bounds]);

  const fit = useCallback(
    (animated = false) => {
      if (!size.w) return;
      const cam = fitCamera(roomBounds, size.w, size.h, insets);
      const cfg = { duration: 420, easing: Easing.out(Easing.cubic) };
      tx.value = animated ? withTiming(cam.tx, cfg) : cam.tx;
      ty.value = animated ? withTiming(cam.ty, cfg) : cam.ty;
      scale.value = animated ? withTiming(cam.scale, cfg) : cam.scale;
    },
    [roomBounds, insets, scale, size.h, size.w, tx, ty],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    vw.value = width;
    vh.value = height;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };
  // Fit once when the view size is first known (and on rotation).
  useEffect(() => {
    fit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  const focusWorld = useCallback(
    (gx: number, gy: number, zoom = 1.5) => {
      if (!size.w) return;
      const s = clampScale(Math.max(scale.value, zoom));
      const w = P(gx, gy, 10);
      const cx = insets.left + (size.w - insets.left - insets.right) / 2;
      const cy = insets.top + (size.h - insets.top - insets.bottom) / 2;
      const cfg = { duration: 480, easing: Easing.out(Easing.cubic) };
      scale.value = withTiming(s, cfg);
      tx.value = withTiming(cx - w.x * s, cfg);
      ty.value = withTiming(cy - w.y * s, cfg);
    },
    [insets, scale, size.h, size.w, tx, ty],
  );

  useImperativeHandle(ref, () => ({
    focusModule: (id) => {
      const m = state.modules[id];
      if (!m) return;
      const f = footprint(m.type, m.rotation);
      focusWorld(m.x + f.w / 2, m.y + f.h / 2, 1.15);
    },
    focusType: (type) => {
      const m = Object.values(state.modules).find((x) => x.type === type);
      if (m) {
        const f = footprint(m.type, m.rotation);
        focusWorld(m.x + f.w / 2, m.y + f.h / 2);
      } else fit(true);
    },
    fit: () => fit(true),
  }));

  const boxes = useMemo<HitBox[]>(
    () => Object.values(state.modules).map((m) => {
      const f = footprint(m.type, m.rotation);
      return { id: m.id, x: m.x, y: m.y, w: f.w, h: f.h, height: m.type === 'corridor' ? 6 : WALL };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.layoutVersion],
  );

  const handleTap = useCallback(
    (x: number, y: number) => {
      const cam = { tx: tx.value, ty: ty.value, scale: scale.value };
      const w = screenToWorld(cam, x, y);
      if (ghost && onGhostMove) {
        const g = worldToGrid(w.x, w.y);
        const f = footprint(ghost.type, ghost.rotation);
        onGhostMove(Math.round(g.x - f.w / 2), Math.round(g.y - f.h / 2));
        return;
      }
      onSelect?.(hitTest(w, boxes));
    },
    [boxes, ghost, onGhostMove, onSelect, scale, tx, ty],
  );

  const handleGhostDrag = useCallback(
    (x: number, y: number) => {
      if (!ghost || !onGhostMove) return;
      const cam = { tx: tx.value, ty: ty.value, scale: scale.value };
      // Keep the outline above the finger so it stays visible.
      const w = screenToWorld(cam, x, y - 56);
      const g = worldToGrid(w.x, w.y);
      const f = footprint(ghost.type, ghost.rotation);
      onGhostMove(Math.round(g.x - f.w / 2), Math.round(g.y - f.h / 2));
    },
    [ghost, onGhostMove, scale, tx, ty],
  );

  const handleLong = useCallback(
    (x: number, y: number) => {
      if (ghost) return;
      const w = screenToWorld({ tx: tx.value, ty: ty.value, scale: scale.value }, x, y);
      const id = hitTest(w, boxes);
      if (id) onLongPress?.(id);
    },
    [boxes, ghost, onLongPress, scale, tx, ty],
  );

  const pan = Gesture.Pan()
    .minDistance(4)
    .averageTouches(true)
    .onStart(() => {
      start.value = { ...start.value, tx: tx.value, ty: ty.value };
    })
    .onUpdate((e) => {
      if (ghostMode.value && e.numberOfPointers === 1) {
        runOnJS(handleGhostDrag)(e.x, e.y);
        return;
      }
      const cam = clampCamera({ tx: start.value.tx + e.translationX, ty: start.value.ty + e.translationY, scale: scale.value }, boundsSV.value, vw.value, vh.value);
      tx.value = cam.tx;
      ty.value = cam.ty;
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      start.value = { tx: tx.value, ty: ty.value, scale: scale.value, fx: e.focalX, fy: e.focalY };
    })
    .onUpdate((e) => {
      const s0 = start.value;
      const s = clampScale(s0.scale * e.scale);
      const k = s / s0.scale;
      const cam = clampCamera({ scale: s, tx: s0.fx - (s0.fx - s0.tx) * k, ty: s0.fy - (s0.fy - s0.ty) * k }, boundsSV.value, vw.value, vh.value);
      scale.value = cam.scale;
      tx.value = cam.tx;
      ty.value = cam.ty;
    });

  const tap = Gesture.Tap()
    .maxDuration(280)
    .onEnd((e, ok) => {
      if (ok) runOnJS(handleTap)(e.x, e.y);
    });

  const longPress = Gesture.LongPress()
    .minDuration(420)
    .onStart((e) => {
      runOnJS(handleLong)(e.x, e.y);
    });

  const gesture = Gesture.Simultaneous(Gesture.Simultaneous(pan, pinch), Gesture.Exclusive(longPress, tap));

  const transform = useDerivedValue(() => [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }]);

  const signature = pictureSignature(state, path);
  const picture = useMemo(
    () => recordShipPicture({ state, path }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  const rect = useMemo(() => pictureRect(state), [state.grid.width, state.grid.height]); // eslint-disable-line react-hooks/exhaustive-deps
  // Cached bitmap of the static ship: 3 px per world unit (≈ 2400 × 1800, ~17 MB), crisp at normal zoom.
  const raster = useMemo(() => {
    try {
      return rasterizeShip(picture, rect, Math.min(3, 4096 / Math.max(rect.width, rect.height)));
    } catch {
      return null;
    }
  }, [picture, rect]);

  const canvas = (
    <Canvas style={StyleSheet.absoluteFill} accessible={false}>
      <Group transform={transform}>
        {raster ? <Image image={raster} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fit="fill" /> : <Picture picture={picture} />}
        <Overlays state={state} signature={overlaySignature(state, overlay)} selectedId={selectedId} ghost={ghost} overlay={overlay} hintType={hintType} />
      </Group>
    </Canvas>
  );

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} accessibilityLabel="Ship view" accessibilityHint="Drag to pan, pinch to zoom, tap a room to inspect it">
      {interactive ? <GestureDetector gesture={gesture}>{<View style={StyleSheet.absoluteFill}>{canvas}</View>}</GestureDetector> : canvas}
    </View>
  );
});

/* ---------------- Animated overlays ---------------- */

interface OverlayProps {
  state: GameState;
  /** Visual signature: the layer re-renders only when this (or a UI prop) changes. */
  signature: string;
  selectedId: string | null;
  ghost: Props['ghost'];
  overlay: OverlayMode;
  hintType: ModuleType | null;
}

const Overlays = memo(function Overlays({ state, selectedId, ghost, overlay, hintType }: OverlayProps) {
  const reducedOS = useReducedMotion();
  const reducedSetting = useSettings((s) => s.reducedMotion);
  const reduced = reducedOS || reducedSetting;
  const clock = useClock();

  const pulse = useDerivedValue(() => (reduced ? 0.75 : 0.55 + 0.45 * Math.sin(clock.value / 650)));
  const steady = useDerivedValue(() => (reduced ? 0.9 : 0.75 + 0.25 * Math.sin(clock.value / 500)));
  const slowPulse = useDerivedValue(() => (reduced ? 0.7 : 0.6 + 0.4 * Math.sin(clock.value / 1300)));
  const flicker = useDerivedValue(() => (reduced ? 0.6 : Math.sin(clock.value / 47) * Math.sin(clock.value / 131) > -0.25 ? 0.95 : 0.3));
  const flash = useDerivedValue(() => (reduced ? 0.5 : (Math.floor(clock.value / 450) % 2 === 0 ? 0.75 : 0.2)));
  const rise = useDerivedValue(() => (reduced ? 0.3 : (clock.value % 1800) / 1800));
  const riseTransform = useDerivedValue(() => [{ translateY: -rise.value * 18 }]);
  const riseOpacity = useDerivedValue(() => 1 - rise.value);
  const dashPhase = useDerivedValue(() => (reduced ? 0 : -((clock.value / 35) % 24)));

  const geo = useMemo(() => {
    const mods = Object.values(state.modules);
    const byId = new Map(mods.map((m) => [m.id, moduleGeo(m)]));
    return { mods, byId };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.layoutVersion]);

  const reactors = geo.mods.filter((m) => m.type === 'reactor');
  const oxygenGens = state.modules ? Object.values(state.modules).filter((m) => m.type === 'oxygen' && m.online) : [];
  const anomalies = useMemo(() => state.anomalies.map((a) => anomalyGeo(state, a)).filter((x) => !!x), [state]);
  const residual = useMemo(
    () => Object.values(state.modules)
      .map((m) => ({ g: geo.byId.get(m.id), e: echoOnModule(state, m, 'residual_energy')?.intensity ?? 0 }))
      .filter((x) => x.g && x.e > 0),
    [geo.byId, state],
  );
  const ghostG = useMemo(() => (ghost ? ghostGeo(state, ghost) : null), [ghost, state]);
  const selected = selectedId ? geo.byId.get(selectedId) : undefined;
  const crewMarks = useMemo(() => {
    const counts = new Map<string, number>();
    const out: { color: string; p: { x: number; y: number }; key: string }[] = [];
    const quarters = Object.values(state.modules).find((m) => m.type === 'quarters');
    for (const c of state.crew) {
      if (c.away) continue;
      const target = c.targetId && state.modules[c.targetId] ? c.targetId : c.targetId ? state.anomalies.find((a) => a.id === c.targetId)?.moduleId : c.task === 'rest' ? quarters?.id : undefined;
      if (!target) continue;
      const g = geo.byId.get(target);
      if (!g) continue;
      const k = counts.get(target) ?? 0;
      counts.set(target, k + 1);
      out.push({ key: c.id, color: CREW_COLOR[c.id] ?? colors.text, p: { x: g.center.x - 10 + k * 10, y: g.center.y - WALL - 10 } });
    }
    return out;
  }, [geo.byId, state]);

  return (
    <Group>
      {/* Data overlays */}
      {overlay !== 'none'
        ? Object.values(state.modules).map((m) => {
            const g = geo.byId.get(m.id);
            const col = overlayColor(state, m, overlay);
            if (!g || !col) return null;
            return (
              <Group key={`ov${m.id}`}>
                <Path path={g.top} color={col} opacity={0.42} />
                <Path path={g.top} color={col} style="stroke" strokeWidth={1.2} opacity={0.9} />
              </Group>
            );
          })
        : null}
      {overlay === 'power'
        ? reactors.flatMap((r) =>
            Object.values(state.modules)
              .filter((m) => m.powered && m.type !== 'corridor' && m.type !== 'reactor')
              .map((m) => {
                const a = geo.byId.get(r.id)!.center;
                const b = geo.byId.get(m.id)?.center;
                if (!b) return null;
                return (
                  <Path key={`pf${r.id}${m.id}`} path={`M ${a.x} ${a.y - WALL} L ${b.x} ${b.y - WALL}`} color={colors.cyan} style="stroke" strokeWidth={1.4} opacity={0.6}>
                    <DashPathEffect intervals={[6, 6]} phase={dashPhase} />
                  </Path>
                );
              }),
          )
        : null}

      {/* Residual energy shimmer */}
      <Group opacity={pulse}>
        {residual.map(({ g, e }) => (
          <Path key={`re${g!.id}`} path={g!.floor} color={colors.amber} opacity={Math.min(0.45, 0.08 + e / 180)}>
          </Path>
        ))}
      </Group>

      {/* Reactor core pulse */}
      <Group opacity={pulse}>
        {reactors.map((r) => {
          const g = geo.byId.get(r.id)!;
          const m = state.modules[r.id];
          if (!m?.online) return null;
          const c = { x: g.center.x, y: g.center.y - 36 };
          const hot = m.temperature > 75;
          return (
            <Circle key={`rc${r.id}`} cx={c.x} cy={c.y} r={hot ? 34 : 26}>
              <RadialGradient c={vec(c.x, c.y)} r={hot ? 34 : 26} colors={[hot ? 'rgba(255,122,61,0.75)' : 'rgba(255,181,71,0.6)', 'rgba(255,181,71,0)']} />
            </Circle>
          );
        })}
      </Group>

      {/* Oxygen flow */}
      <Group transform={riseTransform} opacity={riseOpacity}>
        {oxygenGens.map((m) => {
          const g = geo.byId.get(m.id)!;
          return [0, 1, 2].map((k) => <Circle key={`ox${m.id}${k}`} cx={g.center.x - 6 + k * 6} cy={g.center.y - WALL - 2 - k * 4} r={1.6} color={colors.cyan} opacity={0.8} />);
        })}
      </Group>

      {/* Anomalies */}
      {anomalies.map((a) => {
        if (a.kind === 'bloom') {
          return (
            <Group key={`an${a.id}`} opacity={slowPulse}>
              <Path path={a.floor} color={colors.violet} opacity={Math.min(0.35, a.intensity / 260)} />
              <Path path={a.tendrils} color={colors.violet} style="stroke" strokeWidth={1.6} opacity={0.75} />
              {a.blobs.map((b, i) => (
                <Group key={i}>
                  <Circle cx={b.p.x} cy={b.p.y} r={b.r * 2.2} color="rgba(154,132,240,0.35)">
                  </Circle>
                  <Circle cx={b.p.x} cy={b.p.y} r={b.r} color="#C9B8FF" />
                </Group>
              ))}
            </Group>
          );
        }
        if (a.kind === 'choir') {
          return (
            <Group key={`an${a.id}`} opacity={flicker}>
              <Path path={a.arcs} color={colors.cyan} style="stroke" strokeWidth={1.6}>
              </Path>
              {a.blobs.map((b, i) => <Circle key={i} cx={b.p.x} cy={b.p.y} r={b.r * 0.8} color="#B9F6FF" />)}
            </Group>
          );
        }
        return (
          <Group key={`an${a.id}`} opacity={slowPulse}>
            <Path path={a.floor} color={colors.frost} opacity={Math.min(0.4, a.intensity / 220)} />
            <Path path={a.crystals} color="rgba(190,230,255,0.85)" />
            <Path path={a.crystals} color="#FFFFFF" style="stroke" strokeWidth={0.8} opacity={0.7} />
          </Group>
        );
      })}

      {/* Breaches flash red */}
      <Group opacity={flash}>
        {Object.values(state.modules)
          .filter((m) => m.breached && !m.quarantined)
          .map((m) => {
            const g = geo.byId.get(m.id);
            return g ? <Path key={`br${m.id}`} path={g.floor} color={colors.danger} opacity={0.45} /> : null;
          })}
      </Group>

      {/* Construction progress */}
      {Object.values(state.modules)
        .filter((m) => m.buildRemaining > 0)
        .map((m) => {
          const g = geo.byId.get(m.id);
          if (!g) return null;
          return (
            <Group key={`bp${m.id}`} opacity={pulse}>
              <Path path={g.top} color={colors.cyan} style="stroke" strokeWidth={1.4}>
                <DashPathEffect intervals={[5, 4]} phase={dashPhase} />
              </Path>
            </Group>
          );
        })}

      {/* Status lamps */}
      {Object.values(state.modules)
        .filter((m) => m.type !== 'corridor')
        .map((m) => {
          const g = geo.byId.get(m.id);
          if (!g) return null;
          const col = statusColor(m);
          return (
            <Group key={`st${m.id}`}>
              <Circle cx={g.lamp.x} cy={g.lamp.y} r={4.2} color={col} opacity={0.35}>
              </Circle>
              <Circle cx={g.lamp.x} cy={g.lamp.y} r={2.1} color={col} />
            </Group>
          );
        })}

      {/* Crew markers */}
      {crewMarks.map((c) => (
        <Group key={`cm${c.key}`}>
          <Path path={`M ${c.p.x} ${c.p.y - 5} L ${c.p.x + 4} ${c.p.y} L ${c.p.x} ${c.p.y + 5} L ${c.p.x - 4} ${c.p.y} Z`} color={c.color} />
          <Path path={`M ${c.p.x} ${c.p.y + 6} L ${c.p.x} ${c.p.y + 14}`} color={c.color} style="stroke" strokeWidth={1} opacity={0.6} />
        </Group>
      ))}

      {/* Objective hint */}
      {hintType
        ? Object.values(state.modules)
            .filter((m) => m.type === hintType)
            .slice(0, 1)
            .map((m) => {
              const g = geo.byId.get(m.id);
              return g ? (
                <Group key={`hint${m.id}`} opacity={pulse}>
                  <Path path={g.silhouette} color={colors.amber} style="stroke" strokeWidth={7} opacity={0.25} />
                  <Path path={g.silhouette} color={colors.amber} style="stroke" strokeWidth={2.2}>
                  </Path>
                </Group>
              ) : null;
            })
        : null}

      {/* Selection */}
      {selected ? (
        <Group>
          <Path path={selected.floor} color={colors.cyan} opacity={0.16} />
          <Group opacity={steady}>
            <Path path={selected.silhouette} color={colors.cyan} style="stroke" strokeWidth={7} opacity={0.25} />
            <Path path={selected.silhouette} color={colors.cyan} style="stroke" strokeWidth={2.4}>
            </Path>
          </Group>
        </Group>
      ) : null}

      {/* Build ghost */}
      {ghostG ? (
        <Group>
          {ghostG.cells.map((c, i) => (
            <Path key={`gc${i}`} path={c.path} color={c.ok ? colors.cyan : colors.danger} opacity={0.32} />
          ))}
          <Path path={ghostG.top} color={ghostG.check.valid ? colors.cyan : colors.danger} opacity={0.12} />
          <Group opacity={steady}>
            <Path path={ghostG.frame} color={ghostG.check.valid ? colors.cyan : colors.danger} style="stroke" strokeWidth={2}>
              <DashPathEffect intervals={[7, 4]} phase={dashPhase} />
            </Path>
          </Group>
        </Group>
      ) : null}
    </Group>
  );
}, (a, b) => a.signature === b.signature && a.selectedId === b.selectedId && a.ghost === b.ghost && a.overlay === b.overlay && a.hintType === b.hintType);
