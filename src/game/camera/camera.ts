/**
 * Camera math (pure). screen = world · scale + (tx, ty).
 * The gesture layer in ShipView drives these with Reanimated shared values; the same functions
 * run in worklets, so they avoid closures over non-serialisable values.
 */
export interface Camera {
  tx: number;
  ty: number;
  scale: number;
}

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export const ZOOM = { min: 0.55, max: 2.6 } as const;

export function screenToWorld(cam: Camera, sx: number, sy: number) {
  'worklet';
  return { x: (sx - cam.tx) / cam.scale, y: (sy - cam.ty) / cam.scale };
}

export function worldToScreen(cam: Camera, wx: number, wy: number) {
  'worklet';
  return { x: wx * cam.scale + cam.tx, y: wy * cam.scale + cam.ty };
}

/** Scale and centre the ship inside the viewport, leaving room for the HUD. */
export function fitCamera(bounds: Bounds, vw: number, vh: number, insets = { top: 0, bottom: 0, left: 0, right: 0 }): Camera {
  const availW = Math.max(100, vw - insets.left - insets.right);
  const availH = Math.max(100, vh - insets.top - insets.bottom);
  const scale = clampScale(Math.min(availW / bounds.width, availH / bounds.height) * 0.96);
  const cx = insets.left + availW / 2;
  const cy = insets.top + availH / 2;
  return { scale, tx: cx - (bounds.left + bounds.width / 2) * scale, ty: cy - (bounds.top + bounds.height / 2) * scale };
}

export function clampScale(s: number) {
  'worklet';
  return Math.min(ZOOM.max, Math.max(ZOOM.min, s));
}

/** Keep at least `margin` px of the ship on screen in each direction. */
export function clampCamera(cam: Camera, bounds: Bounds, vw: number, vh: number, margin = 120): Camera {
  'worklet';
  const scale = clampScale(cam.scale);
  const minTx = margin - bounds.right * scale;
  const maxTx = vw - margin - bounds.left * scale;
  const minTy = margin - bounds.bottom * scale;
  const maxTy = vh - margin - bounds.top * scale;
  return {
    scale,
    tx: Math.min(maxTx, Math.max(minTx, cam.tx)),
    ty: Math.min(maxTy, Math.max(minTy, cam.ty)),
  };
}

/** Zoom by `factor` keeping the world point under (fx, fy) fixed on screen. */
export function zoomAround(cam: Camera, fx: number, fy: number, factor: number): Camera {
  'worklet';
  const scale = clampScale(cam.scale * factor);
  const k = scale / cam.scale;
  return { scale, tx: fx - (fx - cam.tx) * k, ty: fy - (fy - cam.ty) * k };
}
