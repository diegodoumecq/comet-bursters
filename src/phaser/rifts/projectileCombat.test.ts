import { describe, expect, it } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import type { ProjectileEntity } from '../projectiles/types';
import { resolveRiftProjectileCombat } from './projectileCombat';
import type { RiftSourceAsteroid } from './types';

function createProjectile(input: Partial<ProjectileEntity> = {}): ProjectileEntity {
  return {
    absorbedFuel: 0,
    ageMs: 0,
    angle: 0,
    collapseStartedAt: null,
    createdAt: 0,
    id: input.id ?? 1,
    kind: input.kind ?? 'small',
    lifetimeMs: 1000,
    membership: { portalId: 7, space: 'rift' },
    position: input.position ?? { x: 100, y: 100 },
    velocity: input.velocity ?? { x: 4, y: 0 },
  };
}

function createSourceAsteroid(input: Partial<AsteroidEntity> = {}): RiftSourceAsteroid {
  const asteroid: AsteroidEntity = {
    id: input.id ?? 1,
    hits: input.hits ?? 2,
    membership: { portalId: 7, space: 'rift' },
    position: input.position ?? { x: 100, y: 100 },
    tier: input.tier ?? 'small',
    velocity: input.velocity ?? { x: 0, y: 0 },
    visualVariant: 0,
  };
  return {
    asteroid,
    portalId: 7,
    sourcePosition: { x: asteroid.position.x, y: asteroid.position.y },
    sourceSpaceId: 7,
  };
}

describe('rift projectile combat', () => {
  it('hits and damages overlapping rift asteroids in rift coordinates', () => {
    const projectile = createProjectile();
    const sourceAsteroid = createSourceAsteroid({ hits: 2 });

    const events = resolveRiftProjectileCombat({
      projectiles: [projectile],
      sourceAsteroids: [sourceAsteroid],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ projectile, sourceAsteroid, type: 'projectileHitAsteroid' });
    expect(sourceAsteroid.asteroid.hits).toBe(1);
    expect(sourceAsteroid.asteroid.velocity.x).toBeGreaterThan(0);
  });

  it('emits a destroyed event when rift asteroid health reaches zero', () => {
    const projectile = createProjectile();
    const sourceAsteroid = createSourceAsteroid({ hits: 1 });

    const events = resolveRiftProjectileCombat({
      projectiles: [projectile],
      sourceAsteroids: [sourceAsteroid],
    });

    expect(events.map((event) => event.type)).toEqual([
      'projectileHitAsteroid',
      'asteroidDestroyed',
    ]);
  });

  it('ignores inspection probes and misses', () => {
    const probe = createProjectile({ kind: 'inspectionProbe' });
    const missedShot = createProjectile({ id: 2, position: { x: 400, y: 400 } });
    const sourceAsteroid = createSourceAsteroid();

    const events = resolveRiftProjectileCombat({
      projectiles: [probe, missedShot],
      sourceAsteroids: [sourceAsteroid],
    });

    expect(events).toEqual([]);
    expect(sourceAsteroid.asteroid.hits).toBe(2);
  });
});
