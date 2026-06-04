import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_FUEL } from '../fuel/rules';
import { FUEL_GUN, PROJECTILES } from './config';
import { fireWeapon } from './fire';
import type { DischargedWeaponKind } from './types';

function lastShotAt(): Record<DischargedWeaponKind, number> {
  return { blackHole: 0, fuelGun: 0, inspectionProbe: 0, pusher: 0, shotgun: 0, small: 0 };
}

describe('fireWeapon', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires two canvas-equivalent shotgun volleys per trigger', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = fireWeapon('shotgun', { x: 1, y: 0 }, 1000, MAX_FUEL, lastShotAt(), {
      x: 0,
      y: 0,
    });

    expect(result.shots).toHaveLength(PROJECTILES.shotgun.count * 2);
    expect(result.fuel).toBe(MAX_FUEL - PROJECTILES.shotgun.fuelCost);
    expect(result.recoil).toEqual({ x: -PROJECTILES.shotgun.recoil, y: -0 });
  });

  it('keeps shotgun pellets within the configured spread', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = fireWeapon('shotgun', { x: 1, y: 0 }, 1000, MAX_FUEL, lastShotAt(), {
      x: 0,
      y: 0,
    });
    const minAngle = -PROJECTILES.shotgun.spread * 0.5;
    const maxAngle = PROJECTILES.shotgun.spread * 0.5;

    expect(result.shots.every((shot) => shot.angle >= minAngle && shot.angle <= maxAngle)).toBe(
      true,
    );
  });

  it('applies canvas-equivalent shotgun speed and lifetime variance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const result = fireWeapon('shotgun', { x: 1, y: 0 }, 1000, MAX_FUEL, lastShotAt(), {
      x: 0,
      y: 0,
    });
    const firstShot = result.shots[0];
    const speed = Math.hypot(firstShot.velocity.x, firstShot.velocity.y);

    expect(speed).toBeCloseTo(PROJECTILES.shotgun.speed * (1 + PROJECTILES.shotgun.speedVariance));
    expect(firstShot.lifetimeMs).toBeCloseTo(PROJECTILES.shotgun.lifetimeMs);
  });

  it('blocks shotgun fire at low fuel', () => {
    const result = fireWeapon('shotgun', { x: 1, y: 0 }, 1000, 5, lastShotAt(), { x: 0, y: 0 });

    expect(result.shots).toHaveLength(0);
    expect(result.fuel).toBe(5);
  });

  it('fires fuel blob shots without projectile shots', () => {
    const result = fireWeapon('fuelGun', { x: 1, y: 0 }, 1000, MAX_FUEL, lastShotAt(), {
      x: 2,
      y: 0,
    });

    expect(result.shots).toHaveLength(0);
    expect(result.fuelBlobShots).toHaveLength(FUEL_GUN.count);
    expect(result.fuel).toBe(MAX_FUEL - FUEL_GUN.fuelCost);
    expect(result.fuelBlobShots[0].velocity).toEqual({ x: FUEL_GUN.speed + 2, y: 0 });
  });
});
