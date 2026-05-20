import { describe, expect, it, vi } from 'vitest';

import { updateFuelBlob } from './blobLogic';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (fromX: number, fromY: number, toX: number, toY: number) =>
          Math.hypot(toX - fromX, toY - fromY),
      },
      FloatBetween: (_min: number, max: number) => max,
    },
  },
}));

const world = { height: 600, width: 800 };

describe('fuel blob movement', () => {
  it('pulls strongly toward the player ship when collectable', () => {
    const blob = {
      id: 1,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };

    updateFuelBlob(blob, { x: 0, y: 0 }, true, 1 / 60, world);

    expect(blob.velocity.x).toBeLessThan(-2);
  });

  it('does not pull toward the player when collection is disabled', () => {
    const blob = {
      id: 1,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };

    updateFuelBlob(blob, { x: 0, y: 0 }, false, 1 / 60, world);

    expect(blob.velocity.x).toBe(0);
  });
});
