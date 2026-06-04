import type { Vector } from '../core/types';
import type { FireMode } from '../fuel/rules';
import { getFireMode, spendWeaponFuel } from '../fuel/rules';
import { FUEL_GUN, PROJECTILES } from './config';
import type { DischargedWeaponKind, ProjectileKind, WeaponKind } from './types';

export type ProjectileShot = {
  angle: number;
  kind: ProjectileKind;
  lifetimeMs: number;
  velocity: Vector;
};

export type FuelBlobShot = {
  angle: number;
  velocity: Vector;
};

export function fireWeapon(
  kind: WeaponKind,
  direction: Vector,
  now: number,
  fuel: number,
  lastShotAt: Record<DischargedWeaponKind, number>,
  shooterVelocity: Vector,
): {
  fuelBlobShots: FuelBlobShot[];
  fuel: number;
  lastShotAt: Record<DischargedWeaponKind, number>;
  recoil: Vector;
  shots: ProjectileShot[];
} {
  if (kind === 'tractor') return noShot(fuel, lastShotAt);
  if (kind === 'fuelGun')
    return fireFuelGun(kind, direction, now, fuel, lastShotAt, shooterVelocity);
  const spec = PROJECTILES[kind];
  if (now - lastShotAt[kind] < spec.fireIntervalMs) return noShot(fuel, lastShotAt);
  const mode = getFireMode(fuel, kind);
  if (!mode) return noShot(fuel, lastShotAt);

  const degradedSmall = isDegradedSmall(kind, mode);
  const baseAngle = Math.atan2(direction.y, direction.x);
  const shots = createShots(kind, baseAngle, shooterVelocity, degradedSmall);
  return {
    fuel: spendWeaponFuel(fuel, kind, mode),
    fuelBlobShots: [],
    lastShotAt: { ...lastShotAt, [kind]: now },
    recoil: { x: -direction.x * spec.recoil, y: -direction.y * spec.recoil },
    shots,
  };
}

function fireFuelGun(
  kind: Extract<WeaponKind, 'fuelGun'>,
  direction: Vector,
  now: number,
  fuel: number,
  lastShotAt: Record<DischargedWeaponKind, number>,
  shooterVelocity: Vector,
): ReturnType<typeof fireWeapon> {
  if (now - lastShotAt[kind] < FUEL_GUN.fireIntervalMs) return noShot(fuel, lastShotAt);
  const mode = getFireMode(fuel, kind);
  if (!mode) return noShot(fuel, lastShotAt);
  const baseAngle = Math.atan2(direction.y, direction.x);
  return {
    fuel: spendWeaponFuel(fuel, kind, mode),
    fuelBlobShots: createFuelBlobShots(baseAngle, shooterVelocity),
    lastShotAt: { ...lastShotAt, [kind]: now },
    recoil: { x: -direction.x * FUEL_GUN.recoil, y: -direction.y * FUEL_GUN.recoil },
    shots: [],
  };
}

function createFuelBlobShots(baseAngle: number, shooterVelocity: Vector): FuelBlobShot[] {
  const shots: FuelBlobShot[] = [];
  for (let index = 0; index < FUEL_GUN.count; index += 1) {
    const offset =
      FUEL_GUN.count === 1 ? 0 : (index / (FUEL_GUN.count - 1) - 0.5) * FUEL_GUN.spread;
    const angle = baseAngle + offset;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    shots.push({
      angle,
      velocity: {
        x: shooterVelocity.x + direction.x * FUEL_GUN.speed,
        y: shooterVelocity.y + direction.y * FUEL_GUN.speed,
      },
    });
  }
  return shots;
}

function createShots(
  kind: ProjectileKind,
  baseAngle: number,
  shooterVelocity: Vector,
  degradedSmall: boolean,
): ProjectileShot[] {
  const shots: ProjectileShot[] = [];
  const volleys = kind === 'shotgun' ? 2 : 1;
  for (let volley = 0; volley < volleys; volley += 1) {
    shots.push(...createShotVolley(kind, baseAngle, shooterVelocity, degradedSmall));
  }
  return shots;
}

function createShotVolley(
  kind: ProjectileKind,
  baseAngle: number,
  shooterVelocity: Vector,
  degradedSmall: boolean,
): ProjectileShot[] {
  const spec = PROJECTILES[kind];
  const scale = degradedSmall ? 0.5 : 1;
  const shots: ProjectileShot[] = [];
  for (let index = 0; index < spec.count; index += 1) {
    const offset = spec.count === 1 ? 0 : (index / (spec.count - 1) - 0.5) * spec.spread;
    const angle = baseAngle + offset;
    const shotDirection = { x: Math.cos(angle), y: Math.sin(angle) };
    const speed = getProjectileSpeed(spec.speed, spec.speedVariance) * scale;
    shots.push({
      angle,
      kind,
      lifetimeMs: getProjectileLifetime(spec.lifetimeMs, spec.speedVariance) * scale,
      velocity: {
        x: shooterVelocity.x + shotDirection.x * speed,
        y: shooterVelocity.y + shotDirection.y * speed,
      },
    });
  }
  return shots;
}

function getProjectileSpeed(speed: number, variance: number): number {
  if (variance <= 0) return speed;
  return speed * (1 - variance + Math.random() * variance * 2);
}

function getProjectileLifetime(lifetimeMs: number, variance: number): number {
  if (variance <= 0) return lifetimeMs;
  return lifetimeMs * (0.7 + Math.random() * 0.3);
}

function isDegradedSmall(kind: ProjectileKind, mode: FireMode): boolean {
  return kind === 'small' && mode === 'degraded';
}

function noShot(fuel: number, lastShotAt: Record<DischargedWeaponKind, number>) {
  return { fuel, fuelBlobShots: [], lastShotAt, recoil: { x: 0, y: 0 }, shots: [] };
}
