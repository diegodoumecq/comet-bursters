import { describe, expect, it } from 'vitest';

import { SANDBOX_NEBULA_REGIONS, type NebulaRegion } from './nebulaRegions';

const WORLD = { height: 48000, width: 48000 };
const MAX_REGION_POINTS = 12;

type Bounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

function getExpandedBounds(region: NebulaRegion): Bounds {
  const bounds = region.points.reduce(
    (current, point) => ({
      bottom: Math.max(current.bottom, point.y),
      left: Math.min(current.left, point.x),
      right: Math.max(current.right, point.x),
      top: Math.min(current.top, point.y),
    }),
    {
      bottom: Number.NEGATIVE_INFINITY,
      left: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
    },
  );
  return {
    bottom: bounds.bottom + region.featherPx,
    left: bounds.left - region.featherPx,
    right: bounds.right + region.featherPx,
    top: bounds.top - region.featherPx,
  };
}

function boundsOverlap(left: Bounds, right: Bounds): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

describe('sandbox nebula regions', () => {
  it('defines sparse coverage for the expanded sandbox', () => {
    expect(SANDBOX_NEBULA_REGIONS).toHaveLength(8);
  });

  it('keeps region polygons within renderer and world limits', () => {
    for (const region of SANDBOX_NEBULA_REGIONS) {
      expect(region.points.length).toBeGreaterThanOrEqual(3);
      expect(region.points.length).toBeLessThanOrEqual(MAX_REGION_POINTS);
      for (const point of region.points) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(WORLD.width);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(WORLD.height);
      }
    }
  });

  it('keeps feathered region bounds from overlapping', () => {
    const regionsWithBounds = SANDBOX_NEBULA_REGIONS.map((region) => ({
      bounds: getExpandedBounds(region),
      id: region.id,
    }));

    for (let leftIndex = 0; leftIndex < regionsWithBounds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < regionsWithBounds.length; rightIndex += 1) {
        expect(
          boundsOverlap(regionsWithBounds[leftIndex].bounds, regionsWithBounds[rightIndex].bounds),
          `${regionsWithBounds[leftIndex].id} overlaps ${regionsWithBounds[rightIndex].id}`,
        ).toBe(false);
      }
    }
  });
});
