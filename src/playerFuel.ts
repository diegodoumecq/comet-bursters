import {
  FUEL_WEAPON_COSTS,
  LOW_FUEL_RATIO,
  STARTING_INSPECTION_PROBES,
  type Bullet,
  type Player,
} from './constants';

export type BulletMode = 'normal' | 'degraded';
export type WeaponType = Bullet['type'];

export function getFuelRatio(player: Player): number {
  return player.maxFuel > 0 ? player.fuel / player.maxFuel : 0;
}

export function isLowFuel(player: Player): boolean {
  return getFuelRatio(player) <= LOW_FUEL_RATIO;
}

export function spendFuel(player: Player, amount: number): boolean {
  if (player.fuel < amount) {
    return false;
  }

  player.fuel = Math.max(0, player.fuel - amount);
  return true;
}

export function drainFuel(player: Player, amount: number): void {
  player.fuel = Math.max(0, player.fuel - amount);
}

export function refillFuel(player: Player): void {
  player.fuel = player.maxFuel;
}

export function refillRespawnResources(player: Player): void {
  refillFuel(player);
  player.inspectionProbes = STARTING_INSPECTION_PROBES;
}

export function getWeaponFireMode(player: Player, type: WeaponType): BulletMode | null {
  if (isLowFuel(player)) {
    return type === 'small' ? 'degraded' : null;
  }

  return spendFuel(player, FUEL_WEAPON_COSTS[type]) ? 'normal' : null;
}
