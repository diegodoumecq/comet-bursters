import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_FUEL } from '../fuel/rules';
import { WEAPON_FIRE_CONFIGS } from './config';
import { fireWeapon } from './fire';
import type {
  DischargedWeaponKind,
  ProjectileEmissionSpec,
  ProjectileKind,
  WeaponKind,
} from './types';

function lastShotAt(): Record<DischargedWeaponKind, number> {
  return { blackHole: 0, fuelGun: 0, inspectionProbe: 0, pusher: 0, shotgun: 0, small: 0 };
}

describe('fireWeapon', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires two canvas-equivalent shotgun volleys per trigger', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = fire('shotgun');
    const fireSpec = WEAPON_FIRE_CONFIGS.shotgun;
    const emission = firstProjectileEmission('shotgun');

    expect(result.projectiles).toHaveLength(emission.count * (emission.volleys ?? 1));
    expect(result.fuel).toBe(MAX_FUEL - fireSpec.fuelCost);
    expect(result.recoil).toEqual({ x: -fireSpec.recoil, y: -0 });
  });

  it('keeps shotgun pellets within the configured spread', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = fire('shotgun');
    const emission = firstProjectileEmission('shotgun');
    const minAngle = -emission.spread * 0.5;
    const maxAngle = emission.spread * 0.5;

    expect(
      result.projectiles.every(
        (projectile) => projectile.angle >= minAngle && projectile.angle <= maxAngle,
      ),
    ).toBe(true);
  });

  it('applies canvas-equivalent shotgun speed and lifetime variance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const result = fire('shotgun');
    const emission = firstProjectileEmission('shotgun');
    const firstProjectile = result.projectiles[0];
    const speed = Math.hypot(firstProjectile.velocity.x, firstProjectile.velocity.y);

    expect(speed).toBeCloseTo(emission.speed * (1 + emission.speedVariance));
    expect(firstProjectile.airResistance).toBe(emission.entity.airResistance);
    expect(firstProjectile.lifetimeMs).toBeCloseTo(emission.entity.lifetimeMs);
  });

  it('fires shotgun even at low fuel', () => {
    const result = fire('shotgun', 5);

    expect(result.projectiles).toHaveLength(
      firstProjectileEmission('shotgun').count * (firstProjectileEmission('shotgun').volleys ?? 1),
    );
    expect(result.fuel).toBe(5);
  });

  it('does not spend fuel for pusher shots', () => {
    const result = fire('pusher', 5);

    expect(result.projectiles).toHaveLength(1);
    expect(result.fuel).toBe(5);
  });

  it('fires fuel blob shots without projectile shots', () => {
    const fuelGunEmission = WEAPON_FIRE_CONFIGS.fuelGun.emissions[0];
    if (fuelGunEmission.type !== 'fuelBlob') throw new Error('Expected fuel blob emission');
    const result = fire('fuelGun', MAX_FUEL, { x: 2, y: 0 });

    expect(result.projectiles).toHaveLength(0);
    expect(result.fuelBlobs).toHaveLength(fuelGunEmission.count);
    expect(result.fuel).toBe(MAX_FUEL - WEAPON_FIRE_CONFIGS.fuelGun.fuelCost);
    expect(result.fuelBlobs[0].airResistance).toBe(fuelGunEmission.entity?.airResistance);
    expect(result.fuelBlobs[0].velocity).toEqual({ x: fuelGunEmission.speed + 2, y: 0 });
  });
});

function fire(kind: WeaponKind, fuel = MAX_FUEL, shooterVelocity = { x: 0, y: 0 }) {
  return fireWeapon({
    direction: { x: 1, y: 0 },
    fuel,
    kind,
    lastShotAt: lastShotAt(),
    nextProjectileId: 10,
    now: 1000,
    origin: { x: 100, y: 200 },
    shooterVelocity,
  });
}

function firstProjectileEmission(weapon: ProjectileKind): ProjectileEmissionSpec {
  const emission = WEAPON_FIRE_CONFIGS[weapon].emissions[0];
  if (emission.type !== 'projectile') throw new Error('Expected projectile emission');
  return emission;
}
