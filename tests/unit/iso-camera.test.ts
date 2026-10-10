import fc from 'fast-check';
import { clampCamera, fitCamera, screenToWorld, worldToScreen, zoomAround, ZOOM } from '@/game/camera/camera';
import { gridBounds, gridToWorld, hitTest, worldToCell, worldToGrid } from '@/game/coordinates/iso';

describe('isometric coordinates', () => {
  it('grid → world → grid is the identity', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 50, noNaN: true }), fc.double({ min: -50, max: 50, noNaN: true }), (gx, gy) => {
        const w = gridToWorld(gx, gy);
        const g = worldToGrid(w.x, w.y);
        expect(g.x).toBeCloseTo(gx, 6);
        expect(g.y).toBeCloseTo(gy, 6);
      }),
    );
  });

  it('a point inside a diamond maps to that cell', () => {
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const c = gridToWorld(x + 0.5, y + 0.5);
        expect(worldToCell(c.x, c.y)).toEqual({ x, y });
      }
    }
  });

  it('hit testing picks the front-most room, including its walls', () => {
    const boxes = [
      { id: 'back', x: 2, y: 2, w: 2, h: 2, height: 26 },
      { id: 'front', x: 4, y: 4, w: 1, h: 1, height: 26 },
    ];
    const floor = gridToWorld(4.5, 4.5);
    expect(hitTest(floor, boxes)).toBe('front');
    // A point on the raised wall above the front module's top corner still hits it.
    const wall = gridToWorld(4.5, 4.05);
    expect(hitTest({ x: wall.x, y: wall.y - 10 }, boxes)).toBe('front');
    expect(hitTest(gridToWorld(3, 3), boxes)).toBe('back');
    expect(hitTest(gridToWorld(8, 8), boxes)).toBeNull();
  });
});

describe('camera', () => {
  const bounds = gridBounds(10, 10);

  it('screen ↔ world conversions are inverse', () => {
    const cam = { tx: 120, ty: -40, scale: 1.7 };
    const w = screenToWorld(cam, 200, 300);
    expect(worldToScreen(cam, w.x, w.y)).toEqual({ x: expect.closeTo(200, 6), y: expect.closeTo(300, 6) });
  });

  it('zooming keeps the focal point fixed and respects limits', () => {
    const cam = { tx: 10, ty: 20, scale: 1 };
    const before = screenToWorld(cam, 150, 250);
    const z = zoomAround(cam, 150, 250, 1.5);
    const after = screenToWorld(z, 150, 250);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(zoomAround(cam, 0, 0, 100).scale).toBe(ZOOM.max);
    expect(zoomAround(cam, 0, 0, 0.001).scale).toBe(ZOOM.min);
  });

  it('fits the ship inside the viewport', () => {
    const cam = fitCamera(bounds, 390, 844, { top: 100, bottom: 200, left: 0, right: 0 });
    const tl = worldToScreen(cam, bounds.left, bounds.top);
    const br = worldToScreen(cam, bounds.right, bounds.bottom);
    expect(tl.x).toBeGreaterThanOrEqual(-1);
    expect(br.x).toBeLessThanOrEqual(391);
    expect(tl.y).toBeGreaterThanOrEqual(99);
    expect(br.y).toBeLessThanOrEqual(645);
  });

  it('panning is bounded so the ship cannot be lost off-screen', () => {
    const far = clampCamera({ tx: 99999, ty: -99999, scale: 1 }, bounds, 390, 844);
    const right = worldToScreen(far, bounds.left, 0).x;
    expect(right).toBeLessThanOrEqual(390 - 120 + 1e-6);
    const bottom = worldToScreen(far, 0, bounds.bottom).y;
    expect(bottom).toBeGreaterThanOrEqual(120 - 1e-6);
  });
});
