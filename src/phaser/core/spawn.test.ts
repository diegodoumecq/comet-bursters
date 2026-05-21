import { describe, expect, it, vi } from 'vitest';

import { chooseSpawnPoint, overlapsAnySpawnCircle, spawnCirclesOverlap } from './spawn';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (fromX: number, fromY: number, toX: number, toY: number) =>
          Math.hypot(toX - fromX, toY - fromY),
      },
    },
  },
}));

describe('spawn primitives', () => {
  it('checks direct and wrapped circle overlap', () => {
    expect(spawnCirclesOverlap(
      { position: { x: 0, y: 0 }, radius: 10 },
      { position: { x: 25, y: 0 }, radius: 10 },
    )).toBe(false);
    expect(spawnCirclesOverlap(
      { position: { x: 5, y: 0 }, radius: 10 },
      { position: { x: 95, y: 0 }, radius: 10 },
      0,
      { type: 'wrapped', world: { width: 100, height: 100 } },
    )).toBe(true);
  });

  it('checks reservations and fallback candidate selection', () => {
    expect(overlapsAnySpawnCircle(
      { position: { x: 0, y: 0 }, radius: 10 },
      [{ position: { x: 15, y: 0 }, radius: 10 }],
    )).toBe(true);
    expect(chooseSpawnPoint({
      attempts: 1,
      createCandidate: () => ({ x: 1, y: 1 }),
      fallback: { x: 2, y: 2 },
      isAllowed: () => false,
    })).toEqual({ x: 2, y: 2 });
  });
});
