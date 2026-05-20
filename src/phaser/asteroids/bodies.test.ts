import { describe, expect, it } from 'vitest';

import { getToroidalOffsets, wrapCoordinate } from './toroidal';
describe('getToroidalOffsets', () => {
  const world = { width: 800, height: 600 };
  const radius = 25;

  it('returns no mirror offsets away from borders', () => {
    expect(getToroidalOffsets({ x: 400, y: 300 }, radius, world)).toEqual([]);
  });

  it('returns the opposite horizontal copy when overlapping the left border', () => {
    expect(getToroidalOffsets({ x: 10, y: 300 }, radius, world)).toEqual([{ x: 800, y: 0 }]);
  });

  it('returns the opposite horizontal copy when overlapping the right border', () => {
    expect(getToroidalOffsets({ x: 790, y: 300 }, radius, world)).toEqual([{ x: -800, y: 0 }]);
  });

  it('returns edge and corner copies when overlapping two borders', () => {
    expect(getToroidalOffsets({ x: 10, y: 10 }, radius, world)).toEqual([
      { x: 0, y: 600 },
      { x: 800, y: 0 },
      { x: 800, y: 600 },
    ]);
  });
});

describe('wrapCoordinate', () => {
  it('wraps values across either side of a world axis', () => {
    expect(wrapCoordinate(-5, 800)).toBe(795);
    expect(wrapCoordinate(805, 800)).toBe(5);
    expect(wrapCoordinate(400, 800)).toBe(400);
  });
});
