import { describe, expect, it, vi } from 'vitest';

import { ASTEROIDS } from '../../asteroids/logic';
import { chooseSafePlayerPosition, chooseSafePlayerPositionWithExclusions, createSafeWaveAsteroids, getBlackHoleSpawnExclusions, getPlayerSpawnCircle, spawnCirclesOverlap } from './arcadeSpawns';

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
      FloatBetween: (min: number, max: number) => (min + max) * 0.5,
    },
  },
}));

const world = { width: 900, height: 700 };

describe('arcade spawns', () => {
  it('chooses a player respawn outside asteroid circles', () => {
    const asteroids = [
      {
        id: 1,
        hits: 1,
        position: { x: world.width * 0.5, y: world.height * 0.5 },
        tier: 'mega' as const,
        velocity: { x: 0, y: 0 },
        visualVariant: 0,
      },
    ];

    const position = chooseSafePlayerPosition(asteroids, world);

    expect(spawnCirclesOverlap(
      getPlayerSpawnCircle(position),
      { position: asteroids[0].position, radius: ASTEROIDS.mega.collisionRadius },
    )).toBe(false);
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

  it('keeps wave asteroids away from the player exclusion circle', () => {
    const playerCircle = getPlayerSpawnCircle({ x: world.width * 0.5, y: world.height * 0.5 });
    const asteroids = createSafeWaveAsteroids(6, world, [playerCircle]);

    expect(asteroids).toHaveLength(8);
    expect(asteroids.every((asteroid) => !spawnCirclesOverlap(
      { position: asteroid.position, radius: ASTEROIDS[asteroid.tier].collisionRadius },
      playerCircle,
      30,
    ))).toBe(true);
  });

  it('keeps wave asteroids from overlapping each other at spawn', () => {
    const asteroids = createSafeWaveAsteroids(8, world);

    for (let leftIndex = 0; leftIndex < asteroids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < asteroids.length; rightIndex += 1) {
        const left = asteroids[leftIndex];
        const right = asteroids[rightIndex];
        expect(spawnCirclesOverlap(
          { position: left.position, radius: ASTEROIDS[left.tier].collisionRadius },
          { position: right.position, radius: ASTEROIDS[right.tier].collisionRadius },
          30,
        )).toBe(false);
      }
    }
  });
});
