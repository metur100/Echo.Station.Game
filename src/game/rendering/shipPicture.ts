/**
 * Records the static ship (hull, rooms, machinery, damage and echo marks) into an SkPicture.
 * It is re-recorded only when the visual signature changes (layout, damage buckets,
 * quarantine, echoes), never per tick. Animated elements live in ShipOverlays.
 */
import { Skia, type SkCanvas, type SkImage, type SkPicture } from '@shopify/react-native-skia';

import { footprint, MODULES } from '../content/modules';
import { gridBounds } from '../coordinates/iso';
import { isHull } from '../engine/grid';
import type { EchoTrace, GameState, ModuleInstance } from '../engine/types';
import { colors } from '../../theme/tokens';
import { box, cylinder, diamond, ellipse, fill, glow, halo, hash01, line, linear, P, poly, radial, ring, shade, shadedBox, stroke } from './drawKit';

export const WALL = 24;
const HULL_DEPTH = 18;

const ACCENT: Record<string, string> = {
  cyan: colors.cyan,
  teal: colors.teal,
  amber: colors.amber,
  violet: colors.violet,
  green: colors.green,
  steel: colors.steel,
};

const FLOOR: Record<string, string> = {
  power: '#1A1A2A',
  life: '#0F2230',
  production: '#10261F',
  research: '#191A36',
  utility: '#172036',
  structure: '#121D33',
  defense: '#0F2033',
  echo: '#1B1734',
};

const PLATE = '#0D182E';
const METAL = '#33456A';

export type ShipPath = 'containment' | 'symbiosis' | 'resonance' | 'neutral';

export interface PictureInput {
  state: GameState;
  path: ShipPath;
}

/** Everything that changes the static picture, as a compact string. */
export function pictureSignature(s: GameState, path: ShipPath): string {
  const mods = Object.values(s.modules)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((m) => {
      const cond = m.condition >= 60 ? 3 : m.condition >= 25 ? 2 : m.condition >= 10 ? 1 : 0;
      return `${m.id}${m.type}${m.x},${m.y},${m.rotation},${m.level},${m.buildRemaining > 0 ? 'b' : ''}${cond}${m.quarantined ? 'q' : ''}${m.breached ? 'x' : ''}${m.enabled ? '' : 'o'}`;
    })
    .join('|');
  const echoes = s.echoes
    .filter((e) => !e.archived && e.kind !== 'resonance' && e.kind !== 'residual_energy')
    .map((e) => `${e.kind}${Math.round(e.intensity / 20)}${e.cells.map((c) => `${c.x}.${c.y}`).join('')}`)
    .join('|');
  return `${s.grid.width}x${s.grid.height}#${path}#${mods}#${echoes}`;
}

/** World-space rectangle the ship picture covers (hull, engine pods, mast). */
export function pictureRect(s: Pick<GameState, 'grid'>) {
  const b = gridBounds(s.grid.width, s.grid.height, WALL + 30);
  return { x: b.left - 80, y: b.top - 80, width: b.width + 160, height: b.height + 200 };
}

export function recordShipPicture({ state: s, path }: PictureInput): SkPicture {
  const r = pictureRect(s);
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(r.x, r.y, r.width, r.height));
  drawHull(c, s, path);
  const mods = Object.values(s.modules).sort((a, m) => depth(a) - depth(m) || (a.id < m.id ? -1 : 1));
  for (const m of mods) drawModule(c, s, m);
  return rec.finishRecordingAsPicture();
}

/**
 * Rasterises the ship picture once into a bitmap at `k` pixels per world unit. Drawing one image
 * per frame is far cheaper than replaying ~1500 anti-aliased paths, which matters because the
 * animated overlays redraw the canvas every frame. Returns null if no surface is available.
 */
export function rasterizeShip(picture: SkPicture, rect: ReturnType<typeof pictureRect>, k: number): SkImage | null {
  const w = Math.ceil(rect.width * k);
  const h = Math.ceil(rect.height * k);
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return null;
  const c = surface.getCanvas();
  c.scale(k, k);
  c.translate(-rect.x, -rect.y);
  c.drawPicture(picture);
  surface.flush();
  return surface.makeImageSnapshot();
}

const depth = (m: ModuleInstance) => {
  const { w, h } = footprint(m.type, m.rotation);
  return m.x + m.y + (w + h) / 2;
};

/* ---------------- Hull ---------------- */

const RIM: Record<ShipPath, string> = {
  neutral: colors.cyan,
  containment: colors.cyan,
  symbiosis: colors.violet,
  resonance: colors.amber,
};

function drawHull(c: SkCanvas, s: GameState, path: ShipPath) {
  const { width, height } = s.grid;
  // Sensor mast at the bow (top corner)
  drawMast(c);

  // Underside and side plating
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isHull(s, x, y)) continue;
      if (!isHull(s, x, y + 1)) c.drawPath(poly([P(x, y + 1), P(x + 1, y + 1), P(x + 1, y + 1, -HULL_DEPTH), P(x, y + 1, -HULL_DEPTH)]), fill(shade('#16213D', 1)));
      if (!isHull(s, x + 1, y)) c.drawPath(poly([P(x + 1, y + 1), P(x + 1, y), P(x + 1, y, -HULL_DEPTH), P(x + 1, y + 1, -HULL_DEPTH)]), fill('#0D162C'));
    }
  }
  // Side panel seams
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isHull(s, x, y)) continue;
      if (!isHull(s, x, y + 1)) line(c, P(x + 0.5, y + 1, -3), P(x + 0.5, y + 1, -HULL_DEPTH + 3), stroke('rgba(120,150,200,0.12)', 1));
      if (!isHull(s, x + 1, y) && (x + y) % 2 === 0) c.drawCircle(P(x + 1, y + 0.5, -HULL_DEPTH / 2).x, P(x + 1, y + 0.5, -HULL_DEPTH / 2).y, 1.6, fill('rgba(69,224,220,0.35)'));
    }
  }

  // Deck plates
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isHull(s, x, y)) continue;
      const v = hash01(`${x},${y}`);
      c.drawPath(poly(diamond(x, y, x + 1, y + 1)), fill(shade(PLATE, 0.92 + v * 0.16)));
      c.drawPath(poly(diamond(x + 0.08, y + 0.08, x + 0.92, y + 0.92)), stroke('rgba(110,140,190,0.07)', 1));
      if (v > 0.7) {
        const p = P(x + 0.2, y + 0.2);
        c.drawCircle(p.x, p.y, 0.9, fill('rgba(140,170,220,0.25)'));
      }
      if (path === 'symbiosis' && v < 0.22) {
        const a = P(x + 0.1, y + 0.6);
        const b2 = P(x + 0.9, y + 0.35);
        c.drawLine(a.x, a.y, b2.x, b2.y, stroke('rgba(154,132,240,0.25)', 1));
      }
      if (path === 'resonance' && v < 0.14) c.drawPath(poly(diamond(x + 0.35, y + 0.35, x + 0.65, y + 0.65)), stroke('rgba(255,181,71,0.25)', 1));
    }
  }

  drawThrusters(c, width, height);

  // Outer rim light
  const rim = RIM[path];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isHull(s, x, y)) continue;
      const edges: [boolean, [number, number], [number, number]][] = [
        [!isHull(s, x, y - 1), [x, y], [x + 1, y]],
        [!isHull(s, x - 1, y), [x, y], [x, y + 1]],
        [!isHull(s, x, y + 1), [x, y + 1], [x + 1, y + 1]],
        [!isHull(s, x + 1, y), [x + 1, y], [x + 1, y + 1]],
      ];
      for (const [open, a, b2] of edges) {
        if (!open) continue;
        line(c, P(a[0], a[1]), P(b2[0], b2[1]), glow(shade(rim, 1, 0.3), 1.4));
        line(c, P(a[0], a[1]), P(b2[0], b2[1]), stroke(shade(rim, 1, 0.55), 1));
      }
    }
  }
}

/** Engine pods bolted to the stern face (the y = height edge), with glowing nozzles. */
function drawThrusters(c: SkCanvas, width: number, height: number) {
  for (const gx of [width / 2 - 2.5, width / 2 + 1.5]) {
    const y0 = height - 0.1;
    shadedBox(c, gx, y0, gx + 1, y0 + 0.55, -HULL_DEPTH + 3, HULL_DEPTH - 6, '#1E2B4C', 'rgba(110,140,190,0.25)');
    // Nozzle on the outward (south-west) face
    const face = [P(gx + 0.18, y0 + 0.55, -HULL_DEPTH + 6), P(gx + 0.82, y0 + 0.55, -HULL_DEPTH + 6), P(gx + 0.82, y0 + 0.55, -6), P(gx + 0.18, y0 + 0.55, -6)];
    c.drawPath(poly(face), fill('#070C18'));
    c.drawPath(poly(face), glow('rgba(69,224,220,0.55)', 3));
    c.drawPath(poly(face), stroke('rgba(140,240,240,0.8)', 1));
  }
}

function drawMast(c: SkCanvas) {
  const base = P(4.6, 0.6, 0);
  const top = { x: base.x, y: base.y - 46 };
  c.drawLine(base.x, base.y, top.x, top.y, stroke('#3A4C70', 2));
  c.drawLine(base.x - 10, base.y - 30, base.x + 10, base.y - 34, stroke('#3A4C70', 1.4));
  halo(c, top.x, top.y, 3, 'rgba(255,90,102,0.8)');
  c.drawCircle(top.x, top.y, 1.6, fill('#FF8A94'));
}

/* ---------------- Rooms ---------------- */

function drawModule(c: SkCanvas, s: GameState, m: ModuleInstance) {
  const def = MODULES[m.type];
  const { w, h } = footprint(m.type, m.rotation);
  const x0 = m.x;
  const y0 = m.y;
  const x1 = m.x + w;
  const y1 = m.y + h;
  const accent = ACCENT[def.accent] ?? colors.cyan;
  const building = m.buildRemaining > 0;
  const corridor = m.type === 'corridor';
  const floorBase = FLOOR[def.category] ?? '#121D33';

  // Floor slab
  c.drawPath(poly(diamond(x0, y0, x1, y1, 1)), fill(shade(floorBase, 1.3)));
  c.drawPath(poly([P(x0, y1, 1), P(x1, y1, 1), P(x1, y1, -2), P(x0, y1, -2)]), fill(shade(floorBase, 0.7)));
  c.drawPath(poly([P(x1, y1, 1), P(x1, y0, 1), P(x1, y0, -2), P(x1, y1, -2)]), fill(shade(floorBase, 0.5)));
  // Floor tiles
  for (let gx = x0; gx <= x1; gx++) line(c, P(gx, y0, 1), P(gx, y1, 1), stroke('rgba(140,170,220,0.06)', 1));
  for (let gy = y0; gy <= y1; gy++) line(c, P(x0, gy, 1), P(x1, gy, 1), stroke('rgba(140,170,220,0.06)', 1));

  if (building) {
    drawBlueprint(c, x0, y0, x1, y1, accent);
    return;
  }

  if (corridor) {
    drawCorridor(c, s, m, accent);
  } else {
    // Back walls
    const wallH = WALL;
    const wallL = [P(x0, y0, 1), P(x0, y1, 1), P(x0, y1, wallH), P(x0, y0, wallH)];
    const wallR = [P(x0, y0, 1), P(x1, y0, 1), P(x1, y0, wallH), P(x0, y0, wallH)];
    c.drawPath(poly(wallL), linear(P(x0, y0, wallH), P(x0, y0, 0), [shade(METAL, 1.05), shade(METAL, 0.75)]));
    c.drawPath(poly(wallR), linear(P(x0, y0, wallH), P(x0, y0, 0), [shade(METAL, 0.85), shade(METAL, 0.55)]));
    // Panel seams
    for (let gy = y0 + 0.5; gy < y1; gy += 0.5) line(c, P(x0, gy, 3), P(x0, gy, wallH - 3), stroke('rgba(0,0,0,0.25)', 1));
    for (let gx = x0 + 0.5; gx < x1; gx += 0.5) line(c, P(gx, y0, 3), P(gx, y0, wallH - 3), stroke('rgba(0,0,0,0.25)', 1));
    // Accent light strip at the base and caps on top
    line(c, P(x0 + 0.02, y0 + 0.05, 3), P(x0 + 0.02, y1, 3), stroke(shade(accent, 1, 0.55), 1.2));
    line(c, P(x0 + 0.05, y0 + 0.02, 3), P(x1, y0 + 0.02, 3), stroke(shade(accent, 1, 0.55), 1.2));
    line(c, P(x0, y1, wallH), P(x0, y0, wallH), stroke('rgba(200,220,255,0.35)', 1.2));
    line(c, P(x0, y0, wallH), P(x1, y0, wallH), stroke('rgba(200,220,255,0.28)', 1.2));
    // Front lip
    line(c, P(x0, y1, 3), P(x1, y1, 3), stroke('rgba(150,180,230,0.25)', 1));
    line(c, P(x1, y1, 3), P(x1, y0, 3), stroke('rgba(150,180,230,0.18)', 1));
    // Soft light pool on the floor
    const ctr = P((x0 + x1) / 2, (y0 + y1) / 2, 1);
    c.drawPath(poly(diamond(x0, y0, x1, y1, 1)), radial(ctr, 22 * Math.max(w, h), [shade(accent, 1, m.enabled ? 0.22 : 0.05), 'rgba(0,0,0,0)']));

    drawMachinery(c, m, x0, y0, x1, y1, accent);
  }

  drawEchoMarks(c, s, m);
  drawDamage(c, m, x0, y0, x1, y1);
  if (m.level > 1) drawLevelPips(c, m, x0, y0, accent);
  if (m.quarantined) drawQuarantine(c, x0, y0, x1, y1);
}

function drawBlueprint(c: SkCanvas, x0: number, y0: number, x1: number, y1: number, accent: string) {
  const e = stroke(shade(accent, 1, 0.6), 1);
  c.drawPath(poly(diamond(x0 + 0.06, y0 + 0.06, x1 - 0.06, y1 - 0.06, 1)), fill(shade(accent, 1, 0.07)));
  c.drawPath(poly(diamond(x0 + 0.06, y0 + 0.06, x1 - 0.06, y1 - 0.06, WALL)), e);
  for (const [gx, gy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) line(c, P(gx, gy, 1), P(gx, gy, WALL), e);
  for (let gx = x0; gx < x1; gx += 0.5) line(c, P(gx, y0, 2), P(gx + 0.5, y0, WALL - 2), stroke(shade(accent, 1, 0.25), 1));
}

function drawCorridor(c: SkCanvas, s: GameState, m: ModuleInstance, accent: string) {
  const { x, y } = m;
  // Low rails on open sides
  const rail = (a: [number, number], b: [number, number]) => {
    line(c, P(a[0], a[1], 5), P(b[0], b[1], 5), stroke('rgba(150,180,230,0.35)', 1.2));
    line(c, P(a[0], a[1], 1), P(b[0], b[1], 1), stroke('rgba(0,0,0,0.35)', 1));
  };
  const occupied = (gx: number, gy: number) => Object.values(s.modules).some((o) => {
    const f = footprint(o.type, o.rotation);
    return gx >= o.x && gx < o.x + f.w && gy >= o.y && gy < o.y + f.h;
  });
  if (!occupied(x - 1, y)) rail([x + 0.08, y], [x + 0.08, y + 1]);
  if (!occupied(x, y - 1)) rail([x, y + 0.08], [x + 1, y + 0.08]);
  // Floor light strip
  c.drawPath(poly(diamond(x + 0.42, y + 0.1, x + 0.58, y + 0.9, 1.2)), fill(shade(accent, 1, 0.22)));
  c.drawPath(poly(diamond(x + 0.1, y + 0.42, x + 0.9, y + 0.58, 1.2)), fill(shade(accent, 1, 0.16)));
  const ctr = P(x + 0.5, y + 0.5, 1.5);
  halo(c, ctr.x, ctr.y, 2, shade(accent, 1, 0.6));
}

function drawLevelPips(c: SkCanvas, m: ModuleInstance, x0: number, y0: number, accent: string) {
  for (let i = 0; i < m.level; i++) {
    const p = P(x0 + 0.18 + i * 0.16, y0, WALL - 6);
    c.drawPath(poly([{ x: p.x, y: p.y - 3 }, { x: p.x + 3, y: p.y }, { x: p.x, y: p.y + 3 }, { x: p.x - 3, y: p.y }]), fill(accent));
  }
}

function drawQuarantine(c: SkCanvas, x0: number, y0: number, x1: number, y1: number) {
  // Hazard stripes along the floor edge and a violet seal over the room
  const pts: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.round(len * 6);
    for (let k = 0; k < n; k += 2) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      line(c, P(ax + (bx - ax) * t0, ay + (by - ay) * t0, 2), P(ax + (bx - ax) * t1, ay + (by - ay) * t1, 2), stroke(colors.amber, 2.4));
    }
  }
  c.drawPath(poly(diamond(x0, y0, x1, y1, WALL)), fill('rgba(154,132,240,0.10)'));
  c.drawPath(poly(diamond(x0, y0, x1, y1, WALL)), stroke('rgba(154,132,240,0.55)', 1));
  for (const [gx, gy] of [[x1, y0], [x0, y1], [x1, y1]]) line(c, P(gx, gy, 2), P(gx, gy, WALL), stroke('rgba(154,132,240,0.4)', 1));
}

function drawDamage(c: SkCanvas, m: ModuleInstance, x0: number, y0: number, x1: number, y1: number) {
  const cond = m.condition;
  if (cond >= 60 && !m.breached) return;
  const n = cond < 25 ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const gx = x0 + 0.2 + hash01(m.id, i) * (x1 - x0 - 0.4);
    const gy = y0 + 0.2 + hash01(m.id, i + 7) * (y1 - y0 - 0.4);
    ellipse(c, gx, gy, 6 + hash01(m.id, i + 3) * 6, 1.5, fill('rgba(5,6,10,0.45)'));
  }
  if (cond < 25 || m.breached) {
    // Cracks
    for (let k = 0; k < 2; k++) {
      let gx = x0 + 0.3 + hash01(m.id, 20 + k) * (x1 - x0 - 0.6);
      let gy = y0 + 0.3 + hash01(m.id, 30 + k) * (y1 - y0 - 0.6);
      const path = Skia.PathBuilder.Make();
      const p0 = P(gx, gy, 1.5);
      path.moveTo(p0.x, p0.y);
      for (let j = 0; j < 4; j++) {
        gx += (hash01(m.id, 40 + j + k * 5) - 0.5) * 0.35;
        gy += (hash01(m.id, 50 + j + k * 5) - 0.3) * 0.3;
        const p = P(gx, gy, 1.5);
        path.lineTo(p.x, p.y);
      }
      c.drawPath(path.build(), stroke(m.breached ? 'rgba(255,88,102,0.8)' : 'rgba(255,181,71,0.45)', 1.2));
    }
  }
  if (cond < 10) c.drawPath(poly(diamond(x0, y0, x1, y1, 1.6)), fill('rgba(255,88,102,0.12)'));
}

function drawEchoMarks(c: SkCanvas, s: GameState, m: ModuleInstance) {
  const { w, h } = footprint(m.type, m.rotation);
  const inside = (e: EchoTrace) => e.cells.some((cell) => cell.x >= m.x && cell.x < m.x + w && cell.y >= m.y && cell.y < m.y + h);
  for (const e of s.echoes) {
    if (e.archived || !inside(e)) continue;
    if (e.kind === 'contamination') {
      const n = 4 + Math.round(e.intensity / 12);
      for (let i = 0; i < n; i++) {
        const gx = m.x + 0.1 + hash01(e.id, i) * (w - 0.2);
        const gy = m.y + 0.1 + hash01(e.id, i + 31) * (h - 0.2);
        const p = P(gx, gy, 1.6);
        c.drawCircle(p.x, p.y, 1.2 + hash01(e.id, i + 9) * 1.8, fill(e.harnessed ? 'rgba(123,211,137,0.45)' : 'rgba(154,132,240,0.45)'));
      }
    } else if (e.kind === 'structural') {
      const path = Skia.PathBuilder.Make();
      for (let k = 0; k < 3; k++) {
        let gx = m.x + hash01(e.id, k) * w;
        let gy = m.y + hash01(e.id, k + 5) * h;
        const p0 = P(gx, gy, 1.7);
        path.moveTo(p0.x, p0.y);
        for (let j = 0; j < 3; j++) {
          gx = Math.min(m.x + w, Math.max(m.x, gx + (hash01(e.id, 10 + j + k * 3) - 0.5) * 0.5));
          gy = Math.min(m.y + h, Math.max(m.y, gy + (hash01(e.id, 20 + j + k * 3) - 0.5) * 0.5));
          const p = P(gx, gy, 1.7);
          path.lineTo(p.x, p.y);
        }
      }
      c.drawPath(path.build(), stroke(e.harnessed ? 'rgba(69,224,220,0.55)' : 'rgba(200,210,230,0.4)', 1));
    }
  }
}

/* ---------------- Machinery ---------------- */

function drawMachinery(c: SkCanvas, m: ModuleInstance, x0: number, y0: number, x1: number, y1: number, accent: string) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const off = !m.enabled;
  const lit = (a: number) => shade(accent, 1, off ? a * 0.25 : a);
  switch (m.type) {
    case 'reactor': {
      shadedBox(c, cx - 0.62, cy - 0.62, cx + 0.62, cy + 0.62, 1, 6, '#2A3550');
      // Coolant pipes to the corners
      for (const [gx, gy] of [[x0 + 0.25, y0 + 0.25], [x1 - 0.25, y0 + 0.25], [x0 + 0.25, y1 - 0.25]]) {
        line(c, P(gx, gy, 4), P(cx, cy, 6), stroke('#3B4A6B', 3));
        cylinder(c, gx, gy, 5, 1, 10, '#33415F');
      }
      cylinder(c, cx, cy, 15, 7, 30, '#3A4A6E', '#55607F');
      ring(c, cx, cy, 15.5, 16, lit(0.9), 2);
      ring(c, cx, cy, 15.5, 27, lit(0.6), 1.4);
      const core = P(cx, cy, 38);
      c.drawOval(Skia.XYWHRect(core.x - 9, core.y - 4.5, 18, 9), radial(core, 10, [lit(1), shade(accent, 0.8, 0)]));
      break;
    }
    case 'oxygen':
    case 'recycler': {
      const vertical = y1 - y0 > x1 - x0;
      const a = vertical ? [cx, y0 + 0.55] : [x0 + 0.55, cy];
      const b = vertical ? [cx, y1 - 0.55] : [x1 - 0.55, cy];
      if (m.type === 'oxygen') {
        cylinder(c, a[0], a[1], 9, 1, 26, '#2E4A68', shade(accent, 0.9));
        cylinder(c, b[0], b[1], 9, 1, 20, '#2E4A68', shade(accent, 0.9));
        ring(c, a[0], a[1], 9.4, 13, lit(0.8), 1.4);
        ring(c, b[0], b[1], 9.4, 10, lit(0.8), 1.4);
        line(c, P(a[0], a[1], 18), P(b[0], b[1], 14), stroke('#4A6487', 2.4));
      } else {
        shadedBox(c, a[0] - 0.3, a[1] - 0.3, a[0] + 0.3, a[1] + 0.3, 1, 8, '#2A4058');
        cylinder(c, a[0], a[1], 8, 9, 10, '#2C5160', shade(accent, 0.85));
        shadedBox(c, b[0] - 0.32, b[1] - 0.25, b[0] + 0.32, b[1] + 0.25, 1, 14, '#283B57');
        line(c, P(b[0] - 0.2, b[1] + 0.25, 10), P(b[0] + 0.2, b[1] + 0.25, 10), stroke(lit(0.9), 1.6));
        line(c, P(a[0], a[1], 14), P(b[0], b[1], 12), stroke('#4A6487', 2.4));
      }
      break;
    }
    case 'hydroponics': {
      const rows = 3;
      const vertical = y1 - y0 >= x1 - x0;
      for (let i = 0; i < rows; i++) {
        const t = (i + 0.5) / rows;
        const [bx0, by0, bx1, by1] = vertical ? [x0 + 0.2 + t * (x1 - x0 - 0.4) - 0.17, y0 + 0.25, x0 + 0.2 + t * (x1 - x0 - 0.4) + 0.17, y1 - 0.25] : [x0 + 0.25, y0 + 0.2 + t * (y1 - y0 - 0.4) - 0.17, x1 - 0.25, y0 + 0.2 + t * (y1 - y0 - 0.4) + 0.17];
        shadedBox(c, bx0, by0, bx1, by1, 1, 6, '#3A2E26');
        const n = 5;
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n;
          const gx = vertical ? (bx0 + bx1) / 2 : bx0 + u * (bx1 - bx0);
          const gy = vertical ? by0 + u * (by1 - by0) : (by0 + by1) / 2;
          const p = P(gx, gy, 9);
          const g = off ? '#2E4A36' : hash01(m.id, i * 10 + k) > 0.5 ? '#5FCB7A' : '#4BAF67';
          c.drawCircle(p.x - 2, p.y, 3.4, fill(shade(g, 0.8)));
          c.drawCircle(p.x + 1.5, p.y - 2, 3.6, fill(g));
          c.drawCircle(p.x, p.y + 1, 2.4, fill(shade(g, 1.2)));
        }
      }
      // Grow lights on the back wall
      line(c, P(x0, y0 + 0.2, WALL - 4), P(x0, y1 - 0.2, WALL - 4), glow(lit(0.8), 3));
      line(c, P(x0 + 0.2, y0, WALL - 4), P(x1 - 0.2, y0, WALL - 4), glow(lit(0.8), 3));
      break;
    }
    case 'quarters': {
      const vertical = y1 - y0 > x1 - x0;
      for (let i = 0; i < 2; i++) {
        const [bx0, by0, bx1, by1] = vertical ? [x0 + 0.15, y0 + 0.15 + i, x0 + 0.62, y0 + 0.85 + i] : [x0 + 0.15 + i, y0 + 0.15, x0 + 0.85 + i, y0 + 0.62];
        shadedBox(c, bx0, by0, bx1, by1, 1, 7, '#30405C');
        shadedBox(c, bx0 + 0.04, by0 + 0.04, bx1 - 0.04, by1 - 0.04, 8, 2, off ? '#5A4A36' : '#B98549');
        const pillow = vertical ? [bx0 + 0.06, by0 + 0.06, bx1 - 0.06, by0 + 0.22] : [bx0 + 0.06, by0 + 0.06, bx0 + 0.22, by1 - 0.06];
        shadedBox(c, pillow[0], pillow[1], pillow[2], pillow[3], 10, 2, '#D9D1C2');
      }
      const lamp = P(vertical ? x1 - 0.2 : x1 - 0.25, vertical ? y1 - 0.25 : y1 - 0.2, 14);
      halo(c, lamp.x, lamp.y, 5, lit(0.6));
      c.drawCircle(lamp.x, lamp.y, 1.8, fill(lit(1)));
      break;
    }
    case 'lab': {
      shadedBox(c, x0 + 0.1, y0 + 0.1, x0 + 0.45, y1 - 0.3, 1, 11, '#2B3757');
      shadedBox(c, x0 + 0.45, y0 + 0.1, x1 - 0.3, y0 + 0.45, 1, 11, '#2B3757');
      // Screens
      const sc = lit(0.85);
      c.drawPath(poly([P(x0 + 0.1, y0 + 0.3, 13), P(x0 + 0.1, y0 + 0.9, 13), P(x0 + 0.1, y0 + 0.9, 21), P(x0 + 0.1, y0 + 0.3, 21)]), fill(sc));
      c.drawPath(poly([P(x0 + 0.7, y0 + 0.1, 13), P(x0 + 1.3, y0 + 0.1, 13), P(x0 + 1.3, y0 + 0.1, 21), P(x0 + 0.7, y0 + 0.1, 21)]), fill(shade(colors.cyan, 1, off ? 0.2 : 0.7)));
      // Specimen tank
      cylinder(c, x1 - 0.55, y1 - 0.55, 10, 1, 6, '#2A3550');
      const tank = P(x1 - 0.55, y1 - 0.55, 7);
      c.drawRect(Skia.XYWHRect(tank.x - 8, tank.y - 22, 16, 22), fill(shade(colors.violet, 1, off ? 0.08 : 0.28)));
      c.drawOval(Skia.XYWHRect(tank.x - 8, tank.y - 26, 16, 8), fill(shade(colors.violet, 1.2, off ? 0.15 : 0.45)));
      halo(c, tank.x, tank.y - 11, 4, shade(colors.violet, 1.2, off ? 0.2 : 0.8));
      break;
    }
    case 'storage': {
      shadedBox(c, x0 + 0.12, y0 + 0.12, x0 + 0.55, y0 + 0.55, 1, 9, '#5B6478');
      shadedBox(c, x0 + 0.55, y0 + 0.15, x0 + 0.88, y0 + 0.5, 1, 7, '#6B5A3E');
      shadedBox(c, x0 + 0.15, y0 + 0.55, x0 + 0.5, y0 + 0.88, 1, 6, '#3E5266');
      shadedBox(c, x0 + 0.16, y0 + 0.16, x0 + 0.5, y0 + 0.5, 10, 7, '#6C7489');
      break;
    }
    case 'airlock': {
      ellipse(c, cx, cy, 15, 1.5, fill('#1B2740'));
      ring(c, cx, cy, 15, 1.6, '#4A5C80', 2);
      ring(c, cx, cy, 9, 1.6, lit(0.9), 1.6);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const p1 = P(cx + Math.cos(a) * 0.12, cy + Math.sin(a) * 0.12, 1.6);
        const p2 = P(cx + Math.cos(a) * 0.3, cy + Math.sin(a) * 0.3, 1.6);
        c.drawLine(p1.x, p1.y, p2.x, p2.y, stroke('#5A6C90', 1.4));
      }
      // Outer door frame on the hull-facing wall
      box(c, x0, y0 + 0.2, x0 + 0.08, y0 + 0.8, 1, WALL - 4, { top: '#3A4C70', left: '#2B3A58', right: '#22304A' });
      line(c, P(x0 + 0.04, y0 + 0.3, 6), P(x0 + 0.04, y0 + 0.7, 6), stroke(lit(1), 2));
      break;
    }
    case 'workshop': {
      const vertical = y1 - y0 > x1 - x0;
      const [bx0, by0, bx1, by1] = vertical ? [x0 + 0.15, y0 + 0.2, x0 + 0.6, y1 - 0.4] : [x0 + 0.2, y0 + 0.15, x1 - 0.4, y0 + 0.6];
      shadedBox(c, bx0, by0, bx1, by1, 1, 10, '#4A3E33');
      const base = vertical ? [x0 + 0.55, y1 - 0.4] : [x1 - 0.4, y0 + 0.55];
      cylinder(c, base[0], base[1], 6, 1, 8, '#4B5A7A');
      const j1 = P(base[0], base[1], 22);
      const j0 = P(base[0], base[1], 9);
      const tip = P((bx0 + bx1) / 2, (by0 + by1) / 2, 18);
      c.drawLine(j0.x, j0.y, j1.x, j1.y, stroke('#8090B0', 3));
      c.drawLine(j1.x, j1.y, tip.x, tip.y, stroke('#8090B0', 2.4));
      halo(c, tip.x, tip.y, 3, lit(0.9));
      break;
    }
    case 'shield': {
      shadedBox(c, cx - 0.45, cy - 0.45, cx + 0.45, cy + 0.45, 1, 5, '#2A3A58');
      cylinder(c, cx, cy, 5, 6, 16, '#3A4C70');
      const dish = P(cx, cy, 24);
      c.drawOval(Skia.XYWHRect(dish.x - 20, dish.y - 8, 40, 16), fill('#4A5E86'));
      c.drawOval(Skia.XYWHRect(dish.x - 20, dish.y - 8, 40, 16), stroke(lit(0.9), 1.4));
      c.drawOval(Skia.XYWHRect(dish.x - 11, dish.y - 4.5, 22, 9), fill(lit(0.35)));
      halo(c, dish.x, dish.y - 6, 3, lit(1));
      break;
    }
    case 'radiator': {
      for (let k = 0; k < 4; k++) {
        const gx = x0 + 0.2 + k * 0.2;
        shadedBox(c, gx, y0 + 0.15, gx + 0.08, y0 + 0.85, 1, 20, '#3A4F6E', shade(accent, 1, 0.4));
      }
      line(c, P(x0 + 0.15, y0 + 0.5, 4), P(x0 + 0.95, y0 + 0.5, 4), stroke(lit(0.7), 2));
      break;
    }
    case 'containment': {
      for (let k = 0; k < 3; k++) ring(c, cx, cy, 13 - k, 4 + k * 8, lit(0.85 - k * 0.15), 1.6);
      for (const a of [0, 2.1, 4.2]) {
        const p1 = P(cx + Math.cos(a) * 0.36, cy + Math.sin(a) * 0.36, 1);
        c.drawLine(p1.x, p1.y, p1.x, p1.y - 22, stroke('#4A5C80', 2));
      }
      const ctr = P(cx, cy, 12);
      halo(c, ctr.x, ctr.y, 5, lit(0.7));
      break;
    }
    case 'condenser': {
      shadedBox(c, cx - 0.3, cy - 0.3, cx + 0.3, cy + 0.3, 1, 5, '#2E2C50');
      const base = P(cx, cy, 8);
      const crystal = [{ x: base.x, y: base.y - 26 }, { x: base.x + 9, y: base.y - 12 }, { x: base.x, y: base.y }, { x: base.x - 9, y: base.y - 12 }];
      c.drawPath(poly(crystal), linear(crystal[0], crystal[2], [shade(colors.violet, 1.4, off ? 0.3 : 0.95), shade(colors.violetDeep, 1, 0.9)]));
      c.drawPath(poly(crystal), stroke(shade(colors.violet, 1.5, 0.8), 1));
      halo(c, base.x, base.y - 12, 3, shade(colors.amber, 1, off ? 0.2 : 0.9));
      break;
    }
    default:
      break;
  }
}
