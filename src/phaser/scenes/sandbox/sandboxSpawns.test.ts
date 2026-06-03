import { describe, expect, it, vi } from 'vitest';

import { ASTEROIDS } from '../../asteroids/logic';
import { PLAYER_COLLISION_RADIUS } from '../../player/config';
import { wrappedDelta } from '../../world/geometry';
import { MOTHERSHIP_CARGO_BAY_OFFSET, MOTHERSHIP_WIDTH } from './Mothership';
import {
  circlesOverlapWrapped,
  createSandboxStartup,
  planetInfluencesPlayerAtSpawn,
} from './sandboxSpawns';
import { SANDBOX_WORLD_CONFIG } from './sandboxWorldConfig';

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
      FloatBetween: (min: number, max: number) => (min + max) * 0.5,
    },
  },
}));

const world = SANDBOX_WORLD_CONFIG.world;
const PLAYTHROUGH_SEED = 'test-playthrough';

describe('sandbox startup spawns', () => {
  it('places startup entities without overlapping reservations', () => {
    const startup = createSandboxStartup(world, 22);
    expect(startup.planets.length).toBeGreaterThan(40);
    expect(startup.asteroids.length).toBeGreaterThan(22);
    expect(startup.nebulaRegions.length).toBeGreaterThan(0);
    const cargoBay = {
      x: startup.spawnPoint.x + MOTHERSHIP_CARGO_BAY_OFFSET.x,
      y: startup.spawnPoint.y + MOTHERSHIP_CARGO_BAY_OFFSET.y,
    };
    const circles = [
      { position: startup.spawnPoint, radius: MOTHERSHIP_WIDTH * 0.5 },
      { position: cargoBay, radius: PLAYER_COLLISION_RADIUS + 120 },
      ...startup.planets.map((planet) => ({ position: planet.position, radius: planet.radius })),
      ...startup.asteroids.map((asteroid) => ({
        position: asteroid.position,
        radius: ASTEROIDS[asteroid.tier].collisionRadius,
      })),
    ];

    for (let leftIndex = 0; leftIndex < circles.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < circles.length; rightIndex += 1) {
        const mothershipAndCargoBay = leftIndex === 0 && rightIndex === 1;
        if (!mothershipAndCargoBay) {
          expect(circlesOverlapWrapped(circles[leftIndex], circles[rightIndex], world)).toBe(false);
        }
      }
    }
  });

  it('places planets outside the player spawn gravity influence zone', () => {
    const startup = createSandboxStartup(world, 22);
    const cargoBay = {
      x: startup.spawnPoint.x + MOTHERSHIP_CARGO_BAY_OFFSET.x,
      y: startup.spawnPoint.y + MOTHERSHIP_CARGO_BAY_OFFSET.y,
    };

    expect(
      startup.planets.every((planet) => !planetInfluencesPlayerAtSpawn(planet, cargoBay, world)),
    ).toBe(true);
  });

  it('creates deterministic startup entities from the playthrough seed', () => {
    const first = createSandboxStartup(world, 22, undefined, SANDBOX_WORLD_CONFIG, PLAYTHROUGH_SEED);
    const second = createSandboxStartup(
      world,
      22,
      undefined,
      SANDBOX_WORLD_CONFIG,
      PLAYTHROUGH_SEED,
    );

    expect(first.spawnPoint).toEqual(second.spawnPoint);
    expect(first.planets.map((planet) => [planet.kind, planet.position])).toEqual(
      second.planets.map((planet) => [planet.kind, planet.position]),
    );
    expect(first.asteroids.map((asteroid) => [asteroid.tier, asteroid.position])).toEqual(
      second.asteroids.map((asteroid) => [asteroid.tier, asteroid.position]),
    );
    expect(first.nebulaRegions.map((region) => [region.effects, region.points])).toEqual(
      second.nebulaRegions.map((region) => [region.effects, region.points]),
    );
  });

  it('changes procedural startup entities when the playthrough seed changes', () => {
    const first = createSandboxStartup(world, 22, undefined, SANDBOX_WORLD_CONFIG, 'seed-a');
    const second = createSandboxStartup(world, 22, undefined, SANDBOX_WORLD_CONFIG, 'seed-b');

    expect(first.spawnPoint).toEqual(second.spawnPoint);
    expect(first.nebulaRegions.map((region) => region.points)).not.toEqual(
      second.nebulaRegions.map((region) => region.points),
    );
  });

  it('uses the configured sandbox spawn point', () => {
    const startup = createSandboxStartup(world, 22, undefined, {
      ...SANDBOX_WORLD_CONFIG,
      spawnPoint: { x: 12345, y: 23456 },
    });

    expect(startup.spawnPoint).toEqual({ x: 12345, y: 23456 });
  });

  it('uses wrapped distance for reservation overlap checks', () => {
    expect(
      circlesOverlapWrapped(
        { position: { x: 10, y: 100 }, radius: 20 },
        { position: { x: world.width - 10, y: 100 }, radius: 20 },
        world,
      ),
    ).toBe(true);
    expect(wrappedDelta({ x: 10, y: 100 }, { x: world.width - 10, y: 100 }, world).x).toBe(-20);
  });
});
