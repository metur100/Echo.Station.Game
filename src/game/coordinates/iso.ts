/**
 * Isometric projection. The simulation works in integer grid cells; rendering works in "world"
 * pixels; the camera maps world pixels to the screen. Nothing else should convert coordinates.
 *
 *   world.x = (gx − gy) · TILE_W / 2
 *   world.y = (gx + gy) · TILE_H / 2
 *
 * Cell (gx, gy) is the diamond with corners top (gx, gy), right (gx+1, gy), bottom (gx+1, gy+1)
 * and left (gx, gy+1).
 */
export const TILE_W = 64;
export const TILE_H = 32;
/** Default wall height of a room in world pixels */
export const ROOM_HEIGHT = 26;

export interface Point {
  x: number;
  y: number;
}

export function gridToWorld(gx: number, gy: number): Point {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}

/** Fractional grid coordinates of a world point on the floor plane. */
export function worldToGrid(wx: number, wy: number): Point {
  const a = wx / (TILE_W / 2);
  const b = wy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export function worldToCell(wx: number, wy: number): Point {
  const g = worldToGrid(wx, wy);
  return { x: Math.floor(g.x), y: Math.floor(g.y) };
}

/** Centre of a w × h footprint at (gx, gy) on the floor. */
export function footprintCenter(gx: number, gy: number, w: number, h: number): Point {
  return gridToWorld(gx + w / 2, gy + h / 2);
}

/** Silhouette of an extruded footprint (six points, clockwise from the raised top corner). */
export function boxSilhouette(gx: number, gy: number, w: number, h: number, height: number): Point[] {
  const top = gridToWorld(gx, gy);
  const right = gridToWorld(gx + w, gy);
  const bottom = gridToWorld(gx + w, gy + h);
  const left = gridToWorld(gx, gy + h);
  return [
    { x: top.x, y: top.y - height },
    { x: right.x, y: right.y - height },
    right,
    bottom,
    left,
    { x: left.x, y: left.y - height },
  ];
}

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Painter's order: draw far (small gx+gy) first. */
export function depthOf(gx: number, gy: number, w: number, h: number): number {
  return gx + gy + (w + h) / 2;
}

export interface HitBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
}

/** Topmost box under a world point, testing front-most boxes first. */
export function hitTest(world: Point, boxes: HitBox[]): string | null {
  const ordered = [...boxes].sort((a, b) => depthOf(b.x, b.y, b.w, b.h) - depthOf(a.x, a.y, a.w, a.h));
  for (const b of ordered) if (pointInPolygon(world, boxSilhouette(b.x, b.y, b.w, b.h, b.height))) return b.id;
  return null;
}

/** World-space bounds of a grid rectangle [x0,x1]×[y0,y1] (including room height). */
export function rectBounds(x0: number, y0: number, x1: number, y1: number, roomHeight = ROOM_HEIGHT) {
  const left = gridToWorld(x0, y1).x;
  const right = gridToWorld(x1, y0).x;
  const top = gridToWorld(x0, y0).y - roomHeight - 20;
  const bottom = gridToWorld(x1, y1).y;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

/** World-space bounds of a grid (including room height). */
export function gridBounds(width: number, height: number, roomHeight = ROOM_HEIGHT) {
  const left = gridToWorld(0, height).x;
  const right = gridToWorld(width, 0).x;
  const top = gridToWorld(0, 0).y - roomHeight - 20;
  const bottom = gridToWorld(width, height).y;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}
