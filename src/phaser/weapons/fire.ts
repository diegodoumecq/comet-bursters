import type { FireMode } from '../fuel/rules';
import type { Vector } from '../core/types';
import type { ProjectileKind, WeaponKind } from './types';
import { getFireMode, spendWeaponFuel } from '../fuel/rules';
import { PROJECTILES } from './config';

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
  const shots: ProjectileShot[] = [];
  for (let index = 0; index < spec.count; index += 1) {
    const offset = spec.count === 1 ? 0 : (index / (spec.count - 1) - 0.5) * spec.spread;
    const angle = baseAngle + offset;
    const shotDirection = { x: Math.cos(angle), y: Math.sin(angle) };
    const scale = degradedSmall ? 0.5 : 1;
    shots.push({
      angle,
      kind,
      lifetimeMs: spec.lifetimeMs * scale,
      velocity: {
        x: shooterVelocity.x + shotDirection.x * spec.speed * scale,
        y: shooterVelocity.y + shotDirection.y * spec.speed * scale,
      },
    });
  }
  return {
    fuel: spendWeaponFuel(fuel, kind, mode),
    lastShotAt: { ...lastShotAt, [kind]: now },
    recoil: { x: -direction.x * spec.recoil, y: -direction.y * spec.recoil },
    shots,
  };
}

function isDegradedSmall(kind: ProjectileKind, mode: FireMode): boolean {
  return kind === 'small' && mode === 'degraded';
}

function noShot(fuel: number, lastShotAt: Record<ProjectileKind, number>) {
  return { fuel, lastShotAt, recoil: { x: 0, y: 0 }, shots: [] };
}
