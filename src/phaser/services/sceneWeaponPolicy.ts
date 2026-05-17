import type { WeaponKind } from '../model';

export type SceneWeaponPolicy = {
  allowedWeapons: readonly WeaponKind[];
};

export const ALL_WEAPONS: readonly WeaponKind[] = ['small', 'pusher', 'shotgun', 'blackHole', 'tractor'];

export function allowsWeapon(policy: SceneWeaponPolicy, weapon: WeaponKind): boolean {
  return policy.allowedWeapons.includes(weapon);
}
