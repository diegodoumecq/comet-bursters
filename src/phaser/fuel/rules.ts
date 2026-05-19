import type { AsteroidTier } from '../asteroids/types';
import type { ProjectileKind, WeaponKind } from '../weapons/types';
import { PROJECTILES } from '../weapons/config';
import { TRACTOR_FUEL_COST_PER_FRAME } from '../weapons/tractorBeam';

export const MAX_FUEL = 100;
export const LOW_FUEL_THRESHOLD = MAX_FUEL * 0.1;
export const THRUST_FUEL_PER_SECOND = 5;
export const FUELLESS_THRUST_SCALE = 1 / 3;
export const FUEL_BLOB_AMOUNT = 5;
export const FUEL_BLOB_RADIUS = 10;
export const FUEL_BLOB_ATTRACTION_RADIUS = 260;
export const FUEL_BLOB_ATTRACTION_ACCELERATION = 0.035 * 60 * 60;
export const FUEL_BLOB_MAX_SPEED = 5.5 * 60;
export const FUEL_BLOB_DRAG_PER_FRAME = 0.985;
export const SHIELD_RADIUS = 24;
export const SHIELD_HIT_COOLDOWN_MS = 50;
export const SHIELD_FUEL_COST: Record<AsteroidTier, number> = {
  mega: 22,
  big: 14,
  medium: 8,
  small: 4,
};

export type FireMode = 'normal' | 'degraded';

export function consumeThrustFuel(fuel: number, deltaSeconds: number, thrusting: boolean): number {
  return thrusting ? Math.max(0, fuel - THRUST_FUEL_PER_SECOND * deltaSeconds) : fuel;
}

export function consumeTractorFuel(fuel: number, deltaSeconds: number, active: boolean): number {
  return active ? Math.max(0, fuel - TRACTOR_FUEL_COST_PER_FRAME * deltaSeconds * 60) : fuel;
}

export function getFireMode(fuel: number, weapon: WeaponKind): FireMode | null {
  if (weapon === 'tractor') return null;
  if (weapon === 'inspectionProbe') return 'normal';
  if (weapon === 'small') return fuel <= LOW_FUEL_THRESHOLD ? 'degraded' : 'normal';
  return fuel <= LOW_FUEL_THRESHOLD || fuel < PROJECTILES[weapon].fuelCost ? null : 'normal';
}

export function spendWeaponFuel(fuel: number, weapon: ProjectileKind, mode: FireMode): number {
  if (weapon === 'small' && mode === 'degraded') return fuel;
  return Math.max(0, fuel - PROJECTILES[weapon].fuelCost);
}

export function addFuel(fuel: number, amount: number): number {
  return Math.min(MAX_FUEL, fuel + amount);
}

export function spendShieldFuel(fuel: number, tier: AsteroidTier): number {
  return Math.max(0, fuel - SHIELD_FUEL_COST[tier]);
}

export function getFuelDropCount(tier: AsteroidTier): number {
  if (tier === 'mega') return Math.floor(Math.random() * 3) + 1;
  if (tier === 'big') return Math.random() < 0.7 ? 1 : 0;
  if (tier === 'medium') return Math.random() < 0.4 ? 1 : 0;
  return 0;
}
