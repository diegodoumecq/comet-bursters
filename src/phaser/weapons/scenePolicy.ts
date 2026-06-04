import type { WeaponKind } from './types';

export type SceneWeaponPolicy = {
  allowedWeapons: readonly WeaponKind[];
};

export const ALL_WEAPONS: readonly WeaponKind[] = [
  'small',
  'pusher',
  'shotgun',
  'blackHole',
  'fuelGun',
  'tractor',
];
export const SANDBOX_WEAPONS: readonly WeaponKind[] = [...ALL_WEAPONS, 'inspectionProbe'];

export function allowsWeapon(policy: SceneWeaponPolicy, weapon: WeaponKind): boolean {
  return policy.allowedWeapons.includes(weapon);
}
