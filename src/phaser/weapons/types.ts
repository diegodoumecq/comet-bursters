export type WeaponKind =
  | 'small'
  | 'pusher'
  | 'shotgun'
  | 'blackHole'
  | 'fuelGun'
  | 'tractor'
  | 'inspectionProbe';
export type ProjectileKind = Exclude<WeaponKind, 'fuelGun' | 'tractor'>;
export type DischargedWeaponKind = Exclude<WeaponKind, 'tractor'>;

export type ProjectileSpec = {
  count: number;
  damage: number;
  fireIntervalMs: number;
  fuelCost: number;
  impact: number;
  lifetimeMs: number;
  radius: number;
  recoil: number;
  speed: number;
  speedVariance: number;
  spread: number;
};

export type FuelGunSpec = {
  count: number;
  fireIntervalMs: number;
  fuelCost: number;
  recoil: number;
  speed: number;
  spread: number;
};
