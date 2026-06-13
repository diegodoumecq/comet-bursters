import { describe, expect, it, vi } from 'vitest';

import {
  getFogCellIndex,
  getMinimapPlayerHeading,
  getMinimapScale,
  getWrappedViewportRects,
  isVisibleOnMinimap,
  projectWorldPoint,
} from './MinimapProjection';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    },
  },
}));

describe('minimap player marker', () => {
  it('points toward player velocity instead of turret aim', () => {
    expect(getMinimapPlayerHeading({ x: 0, y: 4 }, Math.PI)).toBeCloseTo(Math.PI * 0.5);
  });

  it('keeps the ship-facing fallback when the player is not moving', () => {
    expect(getMinimapPlayerHeading({ x: 0, y: 0 }, Math.PI * 0.25)).toBeCloseTo(Math.PI * 0.25);
  });
});

describe('minimap projection', () => {
  it('wraps world positions onto the minimap bounds', () => {
    const world = { height: 1000, width: 1000 };
    const scale = getMinimapScale(world);

    expect(projectWorldPoint({ x: -100, y: 1100 }, world, scale)).toEqual({
      x: 198,
      y: 22,
    });
  });

  it('looks up fog visibility from wrapped world positions', () => {
    const fog = {
      columns: 4,
      discoveredPlanetIds: new Set<number>(),
      exploredCells: new Uint8Array(16),
      rows: 4,
      version: 1,
      visibleCells: new Uint8Array(16),
    };
    fog.visibleCells[15] = 1;

    expect(getFogCellIndex({ x: -1, y: -1 }, fog, { height: 400, width: 400 })).toBe(15);
    expect(isVisibleOnMinimap({ x: -1, y: -1 }, fog, { height: 400, width: 400 })).toBe(true);
  });

  it('splits wrapped viewports across minimap edges', () => {
    const rects = getWrappedViewportRects(
      { height: 100, scrollX: 350, scrollY: 350, width: 100 } as Phaser.Cameras.Scene2D.Camera,
      { height: 400, width: 400 },
      getMinimapScale({ height: 400, width: 400 }),
    );

    expect(rects).toHaveLength(4);
    expect(rects[0].height).toBeCloseTo(55);
    expect(rects[0].width).toBeCloseTo(55);
    expect(rects[0].x).toBeCloseTo(192.5);
    expect(rects[0].y).toBeCloseTo(192.5);
    expect(rects[3].height).toBeCloseTo(55);
    expect(rects[3].width).toBeCloseTo(55);
    expect(rects[3].x).toBeCloseTo(-27.5);
    expect(rects[3].y).toBeCloseTo(-27.5);
  });
});
