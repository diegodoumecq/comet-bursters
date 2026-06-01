import { describe, expect, it, vi } from 'vitest';

import { ASTEROIDS } from '../../asteroids/logic';
import {
  chooseSafePlayerPosition,
  chooseSafePlayerPositionWithExclusions,
  getBlackHoleSpawnExclusions,
  getPlayerSpawnCircle,
  spawnCirclesOverlap,
} from './arcadeSpawns';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: (() => {
        let calls = 0;
        return (min: number, max: number) => {
          calls += 1;
          const progress = ((calls * 997) % 1000) / 999;
          return Math.floor(min + (max - min) * progress);
        };
      })(),
      Distance: {
        Between: (fromX: number, fromY: number, toX: number, toY: number) =>
          Math.hypot(toX - fromX, toY - fromY),
      },
    },
  },
}));

const world = { width: 900, height: 700 };

describe('arcade spawns', () => {
  it('chooses a player respawn outside asteroid circles', () => {
    const asteroids = [
      {
        angularVelocity: 0,
        id: 1,
        hits: 1,
        position: { x: world.width * 0.5, y: world.height * 0.5 },
        rotation: 0,
        tier: 'mega' as const,
        velocity: { x: 0, y: 0 },
        visualVariant: 0,
      },
    ];

    const position = chooseSafePlayerPosition(asteroids, world);

    expect(
      spawnCirclesOverlap(getPlayerSpawnCircle(position), {
        position: asteroids[0].position,
        radius: ASTEROIDS.mega.collisionRadius,
      }),
    ).toBe(false);
  });

  it('chooses a player respawn outside active black hole circles', () => {
    const blackHole = {
      absorbedFuel: 0,
      ageMs: 5000,
      angle: 0,
      collapseStartedAt: null,
      createdAt: 0,
      id: 1,
      kind: 'blackHole' as const,
      lifetimeMs: 10000,
      position: { x: world.width * 0.5, y: world.height * 0.5 },
      velocity: { x: 0, y: 0 },
    };
    const exclusions = getBlackHoleSpawnExclusions([blackHole]);

    const position = chooseSafePlayerPositionWithExclusions([], world, exclusions);

    expect(spawnCirclesOverlap(getPlayerSpawnCircle(position), exclusions[0])).toBe(false);
  });
});
