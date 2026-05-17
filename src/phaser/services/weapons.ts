import type { ProjectileSpec, WeaponKind } from '../model';

export const PROJECTILES: Record<Exclude<WeaponKind, 'tractor'>, ProjectileSpec> = {
  small: { count: 1, damage: 2, impact: 0.2, lifetimeMs: 500, radius: 4, recoil: 0.3, speed: 15, spread: 0 },
  pusher: { count: 1, damage: 0.2, impact: 0.5, lifetimeMs: 1000, radius: 6, recoil: 0.1333, speed: 8, spread: 0 },
  shotgun: { count: 12, damage: 1, impact: 0.02, lifetimeMs: 250, radius: 3, recoil: 0.9, speed: 12, spread: Math.PI / 4 },
  blackHole: { count: 1, damage: 0, impact: 0, lifetimeMs: 10000, radius: 14, recoil: 1.2, speed: 2, spread: 0 },
};

export const FIRE_INTERVAL_MS: Record<WeaponKind, number> = {
  small: 200,
  pusher: 40,
  shotgun: 600,
  blackHole: 2000,
  tractor: 0,
};

export const FUEL_COST: Record<WeaponKind, number> = {
  small: 0.75,
  pusher: 0.2,
  shotgun: 3,
  blackHole: 12,
  tractor: 0.08,
};
