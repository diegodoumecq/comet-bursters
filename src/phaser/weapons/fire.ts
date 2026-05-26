import type { Vector } from '../core/types';
import type { FireMode } from '../fuel/rules';
import { getFireMode, spendWeaponFuel } from '../fuel/rules';
import { PROJECTILES } from './config';
import type { ProjectileKind, WeaponKind } from './types';

export type ProjectileShot = {
  angle: number;
  kind: ProjectileKind;
  lifetimeMs: number;
  velocity: Vector;
};

export function fireWeapon(
  kind: WeaponKind,
  direction: Vector,
  now: number,
  fuel: number,
  lastShotAt: Record<ProjectileKind, number>,
  shooterVelocity: Vector,
): {
  fuel: number;
  lastShotAt: Record<ProjectileKind, number>;
  recoil: Vector;
  shots: ProjectileShot[];
} {
  if (kind === 'tractor') return noShot(fuel, lastShotAt);
  const spec = PROJECTILES[kind];
  if (now - lastShotAt[kind] < spec.fireIntervalMs) return noShot(fuel, lastShotAt);
  const mode = getFireMode(fuel, kind);
  if (!mode) return noShot(fuel, lastShotAt);

  const degradedSmall = isDegradedSmall(kind, mode);
  const baseAngle = Math.atan2(direction.y, direction.x);
  const shots = createShots(kind, baseAngle, shooterVelocity, degradedSmall);
  return {
    fuel: spendWeaponFuel(fuel, kind, mode),
    lastShotAt: { ...lastShotAt, [kind]: now },
    recoil: { x: -direction.x * spec.recoil, y: -direction.y * spec.recoil },
    shots,
  };
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

function noShot(fuel: number, lastShotAt: Record<ProjectileKind, number>) {
  return { fuel, lastShotAt, recoil: { x: 0, y: 0 }, shots: [] };
}
