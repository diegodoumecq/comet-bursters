import { describe, expect, it, vi } from 'vitest';

import { getMinimapPlayerHeading } from './Minimap';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
      RND: {
        uuid: () => 'test',
      },
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
