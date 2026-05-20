import { describe, expect, it } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import { wrappedDelta } from '../world/geometry';
import { resolvePlayerAsteroidCollision } from './asteroids';

function smallAsteroidAt(x: number, y: number): AsteroidEntity {
  return {
    id: 1,
    position: { x, y },
    tier: 'small',
    velocity: { x: 0, y: 0 },
    visualVariant: 0,
  };
}

describe('resolvePlayerAsteroidCollision', () => {
  it('uses wrapped distance when provided', () => {
    const result = resolvePlayerAsteroidCollision({
      asteroid: smallAsteroidAt(790, 300),
      fuel: 100,
      getDelta: (from, to) => wrappedDelta(from, to, { width: 800, height: 600 }),
      now: 1000,
      playerPosition: { x: 10, y: 300 },
      playerVelocity: { x: 0, y: 0 },
      shieldActive: false,
      shieldHitUntil: 0,
    });

    expect(result.hitPlayer).toBe(true);
  });
});
