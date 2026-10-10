/**
 * Imperative Skia drawing helpers for the isometric ship. Everything is drawn in world pixels
 * (see coordinates/iso.ts). Faces are shaded with a fixed light from the upper left:
 * top faces brightest, left (south-west) faces mid, right (south-east) faces darkest.
 */
import { PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode, type SkCanvas, type SkPaint, type SkPath } from '@shopify/react-native-skia';

import { gridToWorld, type Point } from '../coordinates/iso';

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function shade(hex: string, f: number, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  const k = (v: number) => Math.round(Math.max(0, Math.min(255, f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgba(${k(r)}, ${k(g)}, ${k(b)}, ${alpha})`;
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const paintCache = new Map<string, SkPaint>();

export function fill(color: string): SkPaint {
  const key = `f${color}`;
  let p = paintCache.get(key);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color(color));
    paintCache.set(key, p);
  }
  return p;
}

export function stroke(color: string, width = 1): SkPaint {
  const key = `s${color}${width}`;
  let p = paintCache.get(key);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(width);
    p.setStrokeCap(StrokeCap.Round);
    p.setStrokeJoin(StrokeJoin.Round);
    p.setColor(Skia.Color(color));
    paintCache.set(key, p);
  }
  return p;
}

/**
 * Soft glow without blur filters (blurs are replayed every frame and are expensive on mobile
 * GPUs): a wide, faint stroke for lines and outlines.
 */
export function glow(color: string, sigma: number): SkPaint {
  const key = `g${color}${sigma}`;
  let p = paintCache.get(key);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(sigma * 2.2);
    p.setStrokeCap(StrokeCap.Round);
    p.setStrokeJoin(StrokeJoin.Round);
    p.setColor(Skia.Color(color));
    p.setAlphaf(0.35);
    paintCache.set(key, p);
  }
  return p;
}

/** Glowing point light: a bright core with two faint rings of light around it. */
export function halo(c: SkCanvas, x: number, y: number, r: number, color: string) {
  c.drawCircle(x, y, r * 2.4, fill(withAlpha(color, 0.12)));
  c.drawCircle(x, y, r * 1.6, fill(withAlpha(color, 0.25)));
  c.drawCircle(x, y, r, fill(color));
}

/** Replace the alpha of a hex or rgba() colour. */
export function withAlpha(color: string, a: number): string {
  if (color.startsWith('#')) {
    const [r, g, b] = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const m = color.match(/rgba?(([^)]+))/);
  if (!m) return color;
  const [r, g, b, a0] = m[1].split(',').map((v) => parseFloat(v));
  return `rgba(${r}, ${g}, ${b}, ${(isNaN(a0) ? 1 : a0) * a})`;
}

/** Vertical gradient paint (not cached: positions vary) */
export function linear(from: Point, to: Point, colors: string[], positions?: number[]): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeLinearGradient(Skia.Point(from.x, from.y), Skia.Point(to.x, to.y), colors.map((c) => Skia.Color(c)), positions ?? null, TileMode.Clamp));
  return p;
}

export function radial(c: Point, r: number, colors: string[], positions?: number[]): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(Skia.Shader.MakeRadialGradient(Skia.Point(c.x, c.y), r, colors.map((x) => Skia.Color(x)), positions ?? null, TileMode.Clamp));
  return p;
}

/** World point of a grid coordinate lifted by z pixels */
export const P = (gx: number, gy: number, z = 0): Point => {
  const w = gridToWorld(gx, gy);
  return { x: w.x, y: w.y - z };
};

export function poly(points: Point[], close = true): SkPath {
  const path = Skia.PathBuilder.Make();
  points.forEach((pt, i) => (i === 0 ? path.moveTo(pt.x, pt.y) : path.lineTo(pt.x, pt.y)));
  if (close) path.close();
  return path.build();
}

export function line(c: SkCanvas, a: Point, b: Point, paint: SkPaint) {
  c.drawLine(a.x, a.y, b.x, b.y, paint);
}

/** Floor diamond of a rectangle in grid space at height z */
export function diamond(x0: number, y0: number, x1: number, y1: number, z = 0): Point[] {
  return [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
}

export interface BoxColors {
  top: string;
  left: string;
  right: string;
  edge?: string;
}

/** Extruded box over the grid rectangle [x0,x1]×[y0,y1], from height z to z+h. */
export function box(c: SkCanvas, x0: number, y0: number, x1: number, y1: number, z: number, h: number, col: BoxColors) {
  const L = [P(x0, y1, z), P(x1, y1, z), P(x1, y1, z + h), P(x0, y1, z + h)];
  const R = [P(x1, y1, z), P(x1, y0, z), P(x1, y0, z + h), P(x1, y1, z + h)];
  c.drawPath(poly(L), fill(col.left));
  c.drawPath(poly(R), fill(col.right));
  c.drawPath(poly(diamond(x0, y0, x1, y1, z + h)), fill(col.top));
  if (col.edge) {
    const e = stroke(col.edge, 0.8);
    c.drawPath(poly(diamond(x0, y0, x1, y1, z + h)), e);
    line(c, P(x1, y1, z), P(x1, y1, z + h), e);
  }
}

/** Box from a base colour with standard shading */
export function shadedBox(c: SkCanvas, x0: number, y0: number, x1: number, y1: number, z: number, h: number, base: string, edge?: string) {
  box(c, x0, y0, x1, y1, z, h, { top: shade(base, 1.18), left: shade(base, 0.82), right: shade(base, 0.6), edge });
}

/**
 * Vertical cylinder centred on grid point (gx, gy). `r` is the horizontal radius in world px;
 * the ellipse is squashed 2:1 to match the projection.
 */
export function cylinder(c: SkCanvas, gx: number, gy: number, r: number, z: number, h: number, base: string, capColor?: string) {
  const ctr = P(gx, gy, 0);
  const ry = r / 2;
  const top = ctr.y - z - h;
  const bottom = ctr.y - z;
  const body = Skia.PathBuilder.Make();
  body.moveTo(ctr.x - r, top);
  body.lineTo(ctr.x - r, bottom);
  body.arcToOval(Skia.XYWHRect(ctr.x - r, bottom - ry, r * 2, ry * 2), 180, -180, false);
  body.lineTo(ctr.x + r, top);
  body.close();
  c.drawPath(body.build(), linear({ x: ctr.x - r, y: 0 }, { x: ctr.x + r, y: 0 }, [shade(base, 0.95), shade(base, 1.25), shade(base, 0.7), shade(base, 0.45)], [0, 0.35, 0.7, 1]));
  c.drawOval(Skia.XYWHRect(ctr.x - r, top - ry, r * 2, ry * 2), fill(capColor ?? shade(base, 1.3)));
}

/** Ring (ellipse outline) at height z around grid point */
export function ring(c: SkCanvas, gx: number, gy: number, r: number, z: number, color: string, width = 1.2) {
  const ctr = P(gx, gy, z);
  c.drawOval(Skia.XYWHRect(ctr.x - r, ctr.y - r / 2, r * 2, r), stroke(color, width));
}

export function ellipse(c: SkCanvas, gx: number, gy: number, r: number, z: number, paint: SkPaint) {
  const ctr = P(gx, gy, z);
  c.drawOval(Skia.XYWHRect(ctr.x - r, ctr.y - r / 2, r * 2, r), paint);
}

/** Small deterministic hash → 0..1 for decorative variation */
export function hash01(text: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
