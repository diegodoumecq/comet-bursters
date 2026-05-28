import { describe, expect, it } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import { BLACK_HOLE_COLLAPSE_DURATION_MS } from '../projectiles/blackHoles';
import type { ProjectileEntity } from '../projectiles/types';
import { updateRiftBlackHoles } from './blackHoles';
import type { RiftSourceAsteroid, RiftSourceSpace } from './types';

function createBlackHole(input: Partial<ProjectileEntity> = {}): ProjectileEntity {
  return {
    absorbedFuel: input.absorbedFuel ?? 0,
    ageMs: input.ageMs ?? 4000,
    angle: 0,
    blackHoleMass: input.blackHoleMass,
    collapseStartedAt: input.collapseStartedAt ?? null,
    createdAt: input.createdAt ?? 0,
    id: input.id ?? 1,
    kind: 'blackHole',
    lifetimeMs: input.lifetimeMs ?? 10_000,
    membership: { portalId: 3, space: 'rift' },
    position: input.position ?? { x: 300, y: 240 },
    velocity: input.velocity ?? { x: 0, y: 0 },
  };
}

function createSourceAsteroid(input: Partial<AsteroidEntity> = {}): RiftSourceAsteroid {
  const asteroid: AsteroidEntity = {
    id: input.id ?? 1,
    hits: input.hits ?? 1,
    membership: { portalId: 3, space: 'rift' },
    position: input.position ?? { x: 300, y: 240 },
    tier: input.tier ?? 'small',
    velocity: input.velocity ?? { x: 0, y: 0 },
    visualVariant: 0,
  };
  return {
    asteroid,
    portalId: 3,
    sourcePosition: input.position ?? { x: 300, y: 240 },
    sourceSpaceId: 3,
  };
}

function createSourceSpace(input: Partial<RiftSourceSpace> = {}): RiftSourceSpace {
  return {
    asteroids: input.asteroids ?? [],
    fuelBlobs: input.fuelBlobs ?? [],
    id: 3,
    particles: [],
    player: input.player ?? null,
    portal: {
      angle: 0,
      apertureRadiusX: 100,
      apertureRadiusY: 60,
      closeDurationMs: 500,
      closeStartedAt: null,
      durationMs: 5000,
      id: 3,
      openDurationMs: 400,
      openedAt: 0,
      position: { x: 300, y: 200 },
      radiusX: 100,
      radiusY: 60,
      sourcePosition: { x: 300, y: 240 },
      state: 'active',
    },
    projectiles: input.projectiles ?? [],
    size: { width: 900, height: 700 },
    state: 'active',
    timedOutAt: null,
  };
}

describe('rift black holes', () => {
  it('absorbs rift asteroids in source-space coordinates', () => {
    const blackHole = createBlackHole();
    const sourceAsteroid = createSourceAsteroid();
    const sourceSpace = createSourceSpace({
      asteroids: [sourceAsteroid],
      projectiles: [blackHole],
    });

    const events = updateRiftBlackHoles({ sourceSpace, timeScale: 1 });

    expect(events).toEqual([{ sourceAsteroid, type: 'asteroidAbsorbed' }]);
    expect(sourceSpace.asteroids).toEqual([]);
    expect(blackHole.absorbedFuel).toBeGreaterThan(0);
    expect(blackHole.blackHoleMass).toBeGreaterThan(1);
  });

  it('pulls rift fuel blobs and consumes them into black-hole mass', () => {
    const blackHole = createBlackHole();
    const sourceSpace = createSourceSpace({
      fuelBlobs: [
        {
          id: 1,
          membership: { portalId: 3, space: 'rift' },
          position: { x: 310, y: 240 },
          velocity: { x: 0, y: 0 },
          wobbleSeed: 0,
        },
      ],
      projectiles: [blackHole],
    });

    updateRiftBlackHoles({ sourceSpace, timeScale: 1 });

    expect(sourceSpace.fuelBlobs).toEqual([]);
    expect(blackHole.absorbedFuel).toBe(1);
    expect(blackHole.blackHoleMass).toBeGreaterThan(1);
  });

  it('collapses expired rift black holes and emits a fuel burst event', () => {
    const blackHole = createBlackHole({
      ageMs: 6000,
      collapseStartedAt: 6000 - BLACK_HOLE_COLLAPSE_DURATION_MS,
      lifetimeMs: 5000,
    });
    const sourceSpace = createSourceSpace({ projectiles: [blackHole] });

    const events = updateRiftBlackHoles({ sourceSpace, timeScale: 1 });

    expect(events).toEqual([{ projectile: blackHole, type: 'fuelBurst' }]);
    expect(sourceSpace.projectiles).toEqual([]);
  });

  it('absorbs a rift-owned player in source-space coordinates', () => {
    const blackHole = createBlackHole();
    const sourceSpace = createSourceSpace({
      player: {
        membership: { portalId: 3, space: 'rift' },
        position: { x: 300, y: 240 },
        velocity: { x: 0, y: 0 },
      } as RiftSourceSpace['player'],
      projectiles: [blackHole],
    });

    const events = updateRiftBlackHoles({ sourceSpace, timeScale: 1 });

    expect(events).toEqual([{ projectile: blackHole, type: 'playerAbsorbed' }]);
  });
});
