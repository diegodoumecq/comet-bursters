import { describe, expect, it } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import type { PortalEntity } from '../dimensions/types';
import type { ProjectileEntity } from '../projectiles/types';
import {
  getPortalBridgeProjectileAsteroidContacts,
  resolvePortalBridgeAsteroidCollisions,
} from './portalBridge';

const portal: PortalEntity = {
  activeDurationMs: 1000,
  aperture: { radiusX: 120, radiusY: 40 },
  closeStartedAt: null,
  closingDurationMs: 200,
  id: 1,
  lifecycle: 'active',
  normal: { x: 1, y: 0 },
  openedAt: 0,
  openingDurationMs: 200,
  position: { x: 100, y: 100 },
  viewPolicy: 'window',
  visualRadiusX: 120,
  visualRadiusY: 40,
};

describe('resolvePortalBridgeAsteroidCollisions', () => {
  it('bounces overlapping asteroids from different worlds inside an active portal', () => {
    const arcade = createAsteroid(1, 'arcade', { x: 90, y: 100 }, { x: 4, y: 0 });
    const rift = createAsteroid(2, 'rift', { x: 120, y: 100 }, { x: -4, y: 0 });

    const mutations = resolvePortalBridgeAsteroidCollisions({
      arcadeAsteroids: [arcade],
      getDelta: (from, to) => ({ x: to.x - from.x, y: to.y - from.y }),
      portal,
      riftAsteroids: [rift],
    });

    expect(mutations).toHaveLength(2);
    expect(mutations.find((mutation) => mutation.asteroid === arcade)?.velocity.x).toBeLessThan(0);
    expect(mutations.find((mutation) => mutation.asteroid === rift)?.velocity.x).toBeGreaterThan(0);
  });

  it('ignores overlapping asteroids outside the portal aperture', () => {
    const arcade = createAsteroid(1, 'arcade', { x: 260, y: 100 }, { x: 4, y: 0 });
    const rift = createAsteroid(2, 'rift', { x: 285, y: 100 }, { x: -4, y: 0 });

    const mutations = resolvePortalBridgeAsteroidCollisions({
      arcadeAsteroids: [arcade],
      getDelta: (from, to) => ({ x: to.x - from.x, y: to.y - from.y }),
      portal,
      riftAsteroids: [rift],
    });

    expect(mutations).toEqual([]);
  });
});

describe('getPortalBridgeProjectileAsteroidContacts', () => {
  it('connects projectile hits across dimensions inside the portal aperture', () => {
    const projectile = createProjectile(1, 'arcade', { x: 90, y: 100 });
    const asteroid = createAsteroid(2, 'rift', { x: 100, y: 100 }, { x: 0, y: 0 });

    expect(
      getPortalBridgeProjectileAsteroidContacts({
        arcadeAsteroids: [],
        arcadeProjectiles: [projectile],
        getDelta: (from, to) => ({ x: to.x - from.x, y: to.y - from.y }),
        portal,
        riftAsteroids: [asteroid],
        riftProjectiles: [],
      }),
    ).toEqual([{ asteroid, projectile }]);
  });
});

function createAsteroid(
  id: number,
  space: 'arcade' | 'rift',
  position: AsteroidEntity['position'],
  velocity: AsteroidEntity['velocity'],
): AsteroidEntity {
  return {
    angularVelocity: 0,
    hits: 1,
    id,
    membership: { space },
    position,
    rotation: 0,
    tier: 'small',
    velocity,
    visualVariant: 0,
  };
}

function createProjectile(
  id: number,
  space: 'arcade' | 'rift',
  position: ProjectileEntity['position'],
): ProjectileEntity {
  return {
    absorbedFuel: 0,
    ageMs: 0,
    angle: 0,
    collapseStartedAt: null,
    createdAt: 0,
    id,
    kind: 'small',
    lifetimeMs: 1000,
    membership: { space },
    position,
    velocity: { x: 0, y: 0 },
  };
}
