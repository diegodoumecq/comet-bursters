import { describe, expect, it } from 'vitest';

import type { FuelBlobEntity } from '../fuel/types';
import type { ProjectileEntity } from '../projectiles/types';
import { resolveProjectileFuelBlobCombatEvents } from './fuel';

describe('projectile fuel blob combat', () => {
  it('turns projectile contacts into explosion clusters', () => {
    const projectile = createProjectile(1);
    const blobs = [createFuelBlob(1, 0), createFuelBlob(2, 90), createFuelBlob(3, 220)];

    const events = resolveProjectileFuelBlobCombatEvents({
      contacts: [{ blob: blobs[0], projectile }],
      fuelBlobs: blobs,
      getDistance: distance,
      projectiles: [projectile],
    });

    expect(events).toEqual([{ blobs: [blobs[0], blobs[1]], projectile }]);
  });

  it('does not emit duplicate overlapping clusters in the same step', () => {
    const firstProjectile = createProjectile(1);
    const secondProjectile = createProjectile(2);
    const blobs = [createFuelBlob(1, 0), createFuelBlob(2, 90), createFuelBlob(3, 180)];

    const events = resolveProjectileFuelBlobCombatEvents({
      contacts: [
        { blob: blobs[0], projectile: firstProjectile },
        { blob: blobs[1], projectile: secondProjectile },
      ],
      fuelBlobs: blobs,
      getDistance: distance,
      projectiles: [firstProjectile, secondProjectile],
    });

    expect(events).toEqual([{ blobs, projectile: firstProjectile }]);
  });

  it('ignores inactive entities and projectiles that cannot detonate fuel', () => {
    const activeProjectile = createProjectile(1);
    const inactiveProjectile = createProjectile(2);
    const inspectionProbe = createProjectile(3, 'inspectionProbe');
    const activeBlob = createFuelBlob(1, 0);
    const inactiveBlob = createFuelBlob(2, 0);

    const events = resolveProjectileFuelBlobCombatEvents({
      contacts: [
        { blob: inactiveBlob, projectile: activeProjectile },
        { blob: activeBlob, projectile: inactiveProjectile },
        { blob: activeBlob, projectile: inspectionProbe },
      ],
      fuelBlobs: [activeBlob],
      getDistance: distance,
      projectiles: [activeProjectile, inspectionProbe],
    });

    expect(events).toEqual([]);
  });
});

function distance(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function createFuelBlob(id: number, x: number): FuelBlobEntity {
  return {
    id,
    affectedByPlanetGravity: true,
    airResistance: 0.015,
    position: { x, y: 0 },
    velocity: { x: 0, y: 0 },
    wobbleSeed: 0,
  };
}

function createProjectile(
  id: number,
  kind: ProjectileEntity['kind'] = 'small',
): ProjectileEntity {
  return {
    absorbedFuel: 0,
    ageMs: 0,
    angle: 0,
    airResistance: 0.01,
    baseSpeed: kind === 'blackHole' ? 1 : 20,
    blackHoleMass: 0,
    collapseStartedAt: null,
    createdAt: 0,
    damage: kind === 'small' ? 1 : 0,
    id,
    impact: kind === 'small' ? 0.2 : 0,
    kind,
    lifetimeMs: 1000,
    position: { x: 0, y: 0 },
    radius: kind === 'blackHole' ? 6 : 2,
    velocity: { x: 0, y: 0 },
  };
}
