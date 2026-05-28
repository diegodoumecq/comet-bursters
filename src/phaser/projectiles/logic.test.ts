import { describe, expect, it } from 'vitest';

import type { ProjectileBodies } from './bodies';
import { updateProjectiles } from './logic';
import type { ProjectileEntity } from './types';

function createProjectile(input: Partial<ProjectileEntity> = {}): ProjectileEntity {
  return {
    absorbedFuel: 0,
    ageMs: 0,
    angle: 0,
    collapseStartedAt: null,
    createdAt: 0,
    id: input.id ?? 1,
    kind: input.kind ?? 'small',
    lifetimeMs: input.lifetimeMs ?? 1000,
    membership: input.membership ?? { space: 'arcade' },
    position: input.position ?? { x: 10, y: 20 },
    velocity: input.velocity ?? { x: 2, y: 3 },
  };
}

function createProjectileBodies() {
  const synced: ProjectileEntity[] = [];
  return {
    synced,
    runtime: {
      get: () => ({ x: 10, y: 20 }),
      sync: (projectile: ProjectileEntity) => synced.push(projectile),
    } as unknown as ProjectileBodies,
  };
}

describe('projectile logic', () => {
  it('updates arcade projectiles through their Matter body runtime', () => {
    const projectile = createProjectile();
    const bodies = createProjectileBodies();

    const expired = updateProjectiles(
      [projectile],
      bodies.runtime,
      0.25,
      { width: 800, height: 600 },
      false,
    );

    expect(expired).toEqual([]);
    expect(projectile.ageMs).toBe(250);
    expect(bodies.synced).toEqual([projectile]);
  });

  it('leaves rift projectiles for the rift-space updater', () => {
    const projectile = createProjectile({ membership: { portalId: 4, space: 'rift' } });
    const bodies = createProjectileBodies();

    const expired = updateProjectiles(
      [projectile],
      bodies.runtime,
      2,
      { width: 800, height: 600 },
      false,
    );

    expect(expired).toEqual([]);
    expect(projectile.ageMs).toBe(0);
    expect(bodies.synced).toEqual([]);
  });
});
