import type { ProjectileSpec, WeaponKind } from '../model';

export const PROJECTILES: Record<Exclude<WeaponKind, 'tractor'>, ProjectileSpec> = {
  small: { damage: 1, impact: 1, lifetimeMs: 1100, radius: 4, speed: 760 },
  pusher: { damage: 0, impact: 5, lifetimeMs: 900, radius: 6, speed: 520 },
  shotgun: { damage: 1, impact: 1, lifetimeMs: 480, radius: 3, speed: 680 },
  blackHole: { damage: 0, impact: 0, lifetimeMs: 3500, radius: 14, speed: 250 },
};

export const FIRE_INTERVAL_MS: Record<WeaponKind, number> = {
  small: 140,
  pusher: 500,
  shotgun: 650,
  blackHole: 1200,
  tractor: 0,
};
