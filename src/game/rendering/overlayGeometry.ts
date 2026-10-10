/**
 * Pure geometry for the animated overlays, computed once per snapshot (not per frame).
 */
import { Skia, type SkPath } from '@shopify/react-native-skia';

import { footprint, MODULES } from '../content/modules';
import { boxSilhouette, type Point } from '../coordinates/iso';
import { checkPlacement } from '../engine/grid';
import type { GameState, ModuleInstance } from '../engine/types';
import { colors } from '../../theme/tokens';
import { diamond, hash01, mix, P, poly } from './drawKit';
import { WALL } from './shipPicture';

export type OverlayMode = 'none' | 'power' | 'heat' | 'echo' | 'condition';

export const CREW_COLOR: Record<string, string> = {
  ines: colors.amber,
  tomas: colors.violet,
  mira: colors.cyan,
  elias: colors.green,
};

export interface ModuleGeo {
  id: string;
  type: ModuleInstance['type'];
  floor: SkPath;
  top: SkPath;
  silhouette: SkPath;
  center: Point;
  lamp: Point;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function moduleGeo(m: ModuleInstance): ModuleGeo {
  const { w, h } = footprint(m.type, m.rotation);
  const x0 = m.x;
  const y0 = m.y;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const height = m.type === 'corridor' ? 6 : WALL;
  return {
    id: m.id,
    type: m.type,
    floor: poly(diamond(x0, y0, x1, y1, 1.8)),
    top: poly(diamond(x0, y0, x1, y1, height)),
    silhouette: poly(boxSilhouette(x0, y0, w, h, height)),
    center: P((x0 + x1) / 2, (y0 + y1) / 2, 2),
    lamp: P(x0, y1, height + 4),
    x0,
    y0,
    x1,
    y1,
  };
}

export function statusColor(m: ModuleInstance): string {
  if (m.buildRemaining > 0) return colors.cyan;
  if (m.breached || m.offlineReason === 'broken' || m.offlineReason === 'overheated') return colors.danger;
  if (!m.online) return m.offlineReason === 'disabled' || m.offlineReason === 'quarantined' ? colors.textFaint : colors.amber;
  if (m.condition < 40) return colors.amber;
  return colors.success;
}

/** Colour of a module under an overlay mode, or null for no tint. */
export function overlayColor(s: GameState, m: ModuleInstance, mode: OverlayMode): string | null {
  switch (mode) {
    case 'none':
      return null;
    case 'power': {
      const def = MODULES[m.type];
      if (m.type === 'reactor') return m.online ? colors.amber : colors.danger;
      if (def.power === 0) return m.offlineReason === 'broken' ? colors.danger : '#3A4C70';
      if (m.powered) return colors.cyan;
      return m.offlineReason === 'no_power' || m.offlineReason === 'disconnected' ? colors.danger : colors.textFaint;
    }
    case 'heat': {
      const t = m.temperature;
      if (t <= 0) return colors.frost;
      if (t < 15) return mix(colors.frost, colors.teal, t / 15);
      if (t < 30) return mix(colors.teal, colors.success, (t - 15) / 15);
      if (t < MODULES[m.type].maxTemp) return mix(colors.success, colors.amber, Math.min(1, (t - 30) / Math.max(1, MODULES[m.type].maxTemp - 30)));
      return colors.danger;
    }
    case 'condition': {
      const c = m.condition;
      return c >= 60 ? mix(colors.amber, colors.success, (c - 60) / 40) : mix(colors.danger, colors.amber, c / 60);
    }
    case 'echo': {
      let best = 0;
      let kind = '';
      const { w, h } = footprint(m.type, m.rotation);
      for (const e of s.echoes) {
        if (e.archived || e.cells.length === 0) continue;
        if (!e.cells.some((c) => c.x >= m.x && c.x < m.x + w && c.y >= m.y && c.y < m.y + h)) continue;
        if (e.intensity > best) {
          best = e.intensity;
          kind = e.kind;
        }
      }
      if (!best) return '#22304A';
      const base = kind === 'residual_energy' ? colors.amber : kind === 'contamination' ? colors.violet : colors.steel;
      return mix('#22304A', base, Math.min(1, 0.3 + best / 100));
    }
  }
}

export interface AnomalyGeo {
  id: string;
  kind: 'bloom' | 'choir' | 'frost';
  intensity: number;
  blobs: { p: Point; r: number }[];
  tendrils: SkPath;
  arcs: SkPath;
  crystals: SkPath;
  floor: SkPath;
}

export function anomalyGeo(s: GameState, a: GameState['anomalies'][number]): AnomalyGeo | null {
  const m = s.modules[a.moduleId];
  if (!m) return null;
  const { w, h } = footprint(m.type, m.rotation);
  const n = 2 + Math.round(a.intensity / 14);
  const blobs: { p: Point; r: number }[] = [];
  const tendrils = Skia.PathBuilder.Make();
  const arcs = Skia.PathBuilder.Make();
  const crystals = Skia.PathBuilder.Make();
  const cx = m.x + w / 2;
  const cy = m.y + h / 2;
  for (let i = 0; i < n; i++) {
    const gx = m.x + 0.15 + hash01(a.id, i) * (w - 0.3);
    const gy = m.y + 0.15 + hash01(a.id, i + 17) * (h - 0.3);
    const z = 2 + hash01(a.id, i + 5) * (a.kind === 'bloom' ? WALL * 0.7 : 10);
    const p = P(gx, gy, z);
    blobs.push({ p, r: 1.8 + hash01(a.id, i + 3) * (2 + a.intensity / 25) });
    if (a.kind === 'bloom') {
      const base = P(gx, gy, 1.5);
      const ctrl = P((gx + cx) / 2, (gy + cy) / 2, z * 0.4);
      tendrils.moveTo(base.x, base.y);
      tendrils.quadTo(ctrl.x, ctrl.y, p.x, p.y);
    } else if (a.kind === 'choir') {
      const start = P(cx, cy, 8);
      arcs.moveTo(start.x, start.y);
      let x = start.x;
      let y = start.y;
      for (let k = 0; k < 4; k++) {
        x += (p.x - start.x) / 4 + (hash01(a.id, i * 9 + k) - 0.5) * 8;
        y += (p.y - start.y) / 4 + (hash01(a.id, i * 7 + k) - 0.5) * 6;
        arcs.lineTo(x, y);
      }
    } else {
      const base = P(gx, gy, 1.5);
      const hgt = 6 + hash01(a.id, i + 40) * (6 + a.intensity / 8);
      const wid = 2 + hash01(a.id, i + 41) * 2.5;
      crystals.moveTo(base.x - wid, base.y);
      crystals.lineTo(base.x + (hash01(a.id, i + 42) - 0.5) * 4, base.y - hgt);
      crystals.lineTo(base.x + wid, base.y);
      crystals.close();
    }
  }
  return { id: a.id, kind: a.kind, intensity: a.intensity, blobs, tendrils: tendrils.build(), arcs: arcs.build(), crystals: crystals.build(), floor: poly(diamond(m.x, m.y, m.x + w, m.y + h, 1.8)) };
}

export function ghostGeo(s: GameState, ghost: { type: ModuleInstance['type']; x: number; y: number; rotation: 0 | 1 }) {
  const check = checkPlacement(s, ghost.type, ghost.x, ghost.y, ghost.rotation);
  const { w, h } = footprint(ghost.type, ghost.rotation);
  return {
    check,
    cells: check.cells.map((c) => ({ path: poly(diamond(c.x, c.y, c.x + 1, c.y + 1, 2)), ok: c.ok })),
    frame: poly(boxSilhouette(ghost.x, ghost.y, w, h, ghost.type === 'corridor' ? 6 : WALL)),
    top: poly(diamond(ghost.x, ghost.y, ghost.x + w, ghost.y + h, ghost.type === 'corridor' ? 6 : WALL)),
  };
}

/**
 * Everything the animated overlays depend on, bucketed to visible steps. The overlay layer only
 * re-renders (and Skia only re-records it) when this string changes, not on every tick.
 */
export function overlaySignature(s: GameState, mode: OverlayMode): string {
  const parts: string[] = [mode, String(s.layoutVersion)];
  for (const m of Object.values(s.modules)) {
    let v = `${m.id}${m.online ? 1 : 0}${m.powered ? 1 : 0}${m.offlineReason ?? ''}${m.breached ? 'b' : ''}${m.quarantined ? 'q' : ''}${m.buildRemaining > 0 ? 'c' : ''}${m.condition < 40 ? 'w' : ''}`;
    if (mode === 'heat') v += Math.round(m.temperature / 3);
    if (mode === 'condition') v += Math.round(m.condition / 5);
    parts.push(v);
  }
  for (const a of s.anomalies) parts.push(`${a.id}${a.moduleId}${Math.round(a.intensity / 4)}${a.exploited ? 'x' : ''}`);
  for (const e of s.echoes) if (!e.archived) parts.push(`${e.id}${Math.round(e.intensity / 5)}`);
  for (const c of s.crew) parts.push(`${c.id}${c.away ? 'a' : ''}${c.task}${c.targetId ?? ''}`);
  return parts.join('|');
}
