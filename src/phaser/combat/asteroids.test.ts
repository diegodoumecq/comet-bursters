import { describe, expect, it } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import { SHIELD_RADIUS } from '../fuel/rules';
import { PLAYER_COLLISION_RADIUS } from '../player/config';
import { wrappedDelta } from '../world/geometry';
import { resolvePlayerAsteroidCollision } from './asteroids';

function smallAsteroidAt(x: number, y: number): AsteroidEntity {
  return {
    angularVelocity: 0,
    id: 1,
    position: { x, y },
    rotation: 0,
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
      playerRadius: PLAYER_COLLISION_RADIUS,
      playerVelocity: { x: 0, y: 0 },
      shieldActive: false,
      shieldRadius: SHIELD_RADIUS,
      shieldHitUntil: 0,
    });

    expect(result.hitPlayer).toBe(true);
  });

  it('uses scaled player radius for ship collisions', () => {
    const normal = resolvePlayerAsteroidCollision({
      asteroid: smallAsteroidAt(45, 0),
      fuel: 100,
      now: 1000,
      playerPosition: { x: 0, y: 0 },
      playerRadius: PLAYER_COLLISION_RADIUS,
      playerVelocity: { x: 0, y: 0 },
      shieldActive: false,
      shieldRadius: SHIELD_RADIUS,
      shieldHitUntil: 0,
    });
    const scaled = resolvePlayerAsteroidCollision({
      asteroid: smallAsteroidAt(45, 0),
      fuel: 100,
      now: 1000,
      playerPosition: { x: 0, y: 0 },
      playerRadius: 40,
      playerVelocity: { x: 0, y: 0 },
      shieldActive: false,
      shieldRadius: SHIELD_RADIUS,
      shieldHitUntil: 0,
    });

    expect(normal.hitPlayer).toBe(false);
    expect(scaled.hitPlayer).toBe(true);
  });
});
