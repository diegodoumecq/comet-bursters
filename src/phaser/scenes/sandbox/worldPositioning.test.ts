import { describe, expect, it, vi } from 'vitest';

import type { AsteroidEntity } from '../../asteroids/types';
import type { Vector } from '../../core/types';
import type { FuelBlobEntity } from '../../fuel/types';
import type { ParticleEntity } from '../../particles/types';
import type { ProjectileEntity } from '../../projectiles/types';
import type { SandboxPlanetEntity } from './planetFuel';
import {
  positionSandboxWrappedWorldNearPlayer,
  rebaseSandboxWorldAtBounds,
  type SandboxWorldRebaseInput,
} from './worldPositioning';

describe('sandbox world positioning', () => {
  it('syncs fuel blobs from Matter before repositioning them near the player', () => {
    const blob: FuelBlobEntity = {
      id: 1,
      airResistance: 0.015,
      gravityScale: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 24, y: 0 },
      wobbleSeed: 0,
    };
    const fuelBodies = {
      setPosition: vi.fn((target: FuelBlobEntity, position: FuelBlobEntity['position']) => {
        target.position = { ...position };
      }),
      sync: vi.fn((target: FuelBlobEntity) => {
        target.position = { x: 124, y: 100 };
      }),
    };

    positionSandboxWrappedWorldNearPlayer({
      asteroidBodies: { get: vi.fn() },
      fuelBodies,
      mothership: { keepNear: vi.fn(), sync: vi.fn() },
      now: 1000,
      particleViews: { sync: vi.fn() },
      planetViews: { sync: vi.fn() },
      planets: [],
      player: { position: { x: 100, y: 100 } },
      projectileBodies: { setPosition: vi.fn() },
      runtime: { world: { asteroids: [], fuelBlobs: [blob], particles: [], projectiles: [] } },
      world: { height: 1000, width: 1000 },
    });

    expect(fuelBodies.sync).toHaveBeenCalledWith(blob);
    expect(fuelBodies.setPosition).toHaveBeenCalledWith(blob, { x: 124, y: 100 });
    expect(blob.position).toEqual({ x: 124, y: 100 });
  });

  it('rebases every sandbox domain when the player crosses the world bounds', () => {
    const player = { position: { x: 1001, y: 100 } };
    const planet = createPlanet({ x: 25, y: 30 });
    const asteroid = createAsteroid({ x: 50, y: 60 });
    const projectile = createProjectile({ x: 70, y: 80 });
    const blob: FuelBlobEntity = {
      id: 1,
      airResistance: 0.015,
      position: { x: 90, y: 100 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };
    const particle = createParticle({ x: 110, y: 120 });
    const asteroidBody = { setPosition: vi.fn() };
    const fuelBodies = {
      setPosition: vi.fn((target: FuelBlobEntity, position: FuelBlobEntity['position']) => {
        target.position = { ...position };
      }),
      sync: vi.fn(),
    };
    const input = {
      asteroidBodies: { get: vi.fn(() => asteroidBody) },
      fuelBodies,
      mothership: { moveBy: vi.fn(), sync: vi.fn() },
      now: 1000,
      particleViews: { sync: vi.fn() },
      planetViews: { sync: vi.fn() },
      planets: [planet],
      player,
      playerBody: {
        setPosition: vi.fn((position: typeof player.position) => {
          player.position = { ...position };
        }),
        shieldSensor: { setPosition: vi.fn() },
      },
      projectileBodies: {
        setPosition: vi.fn((target: typeof projectile, position: typeof projectile.position) => {
          target.position = { ...position };
        }),
      },
      runtime: {
        world: {
          asteroids: [asteroid],
          fuelBlobs: [blob],
          particles: [particle],
          projectiles: [projectile],
        },
      },
      world: { height: 1000, width: 1000 },
    } satisfies SandboxWorldRebaseInput;

    rebaseSandboxWorldAtBounds(input);

    expect(player.position).toEqual({ x: 1, y: 100 });
    expect(planet.position).toEqual({ x: -975, y: 30 });
    expect(asteroid.position).toEqual({ x: -950, y: 60 });
    expect(projectile.position).toEqual({ x: -930, y: 80 });
    expect(blob.position).toEqual({ x: -910, y: 100 });
    expect(particle.position).toEqual({ x: -890, y: 120 });
    expect(asteroidBody.setPosition).toHaveBeenCalledWith(-950, 60);
    expect(fuelBodies.sync).toHaveBeenCalledWith(blob);
    expect(input.mothership.moveBy).toHaveBeenCalledWith({ x: -1000, y: 0 });
  });
});

function createAsteroid(position: Vector): AsteroidEntity {
  return {
    angularVelocity: 0,
    id: 1,
    position,
    rotation: 0,
    tier: 'small',
    velocity: { x: 0, y: 0 },
    visualVariant: 0,
  };
}

function createParticle(position: Vector): ParticleEntity {
  return {
    alphaDecayPerSecond: 0,
    color: 0xffffff,
    dragPerSecond: 0,
    id: 1,
    kind: 'circle',
    lifetimeMs: 1000,
    maxLifetimeMs: 1000,
    position,
    rotation: 0,
    velocity: { x: 0, y: 0 },
  };
}

function createPlanet(position: Vector): SandboxPlanetEntity {
  return {
    altitudeVariations: [],
    color: 0xffffff,
    colorHex: '#ffffff',
    extractor: {
      angle: 0,
      blobs: [],
      nextExtractAt: 0,
    },
    fuelReserve: 0,
    gravityStrength: 0,
    id: 1,
    inspectedUntil: 0,
    kind: 'lush',
    position,
    radius: 40,
    rotation: 0,
    rotationSpeed: 0,
    visualSeed: 0,
  };
}

function createProjectile(position: Vector): ProjectileEntity {
  return {
    absorbedFuel: 0,
    ageMs: 0,
    airResistance: 0,
    angle: 0,
    baseSpeed: 0,
    collapseStartedAt: null,
    createdAt: 0,
    damage: 0,
    id: 1,
    impact: 0,
    kind: 'small',
    lifetimeMs: 1000,
    position,
    radius: 1,
    velocity: { x: 0, y: 0 },
  };
}
