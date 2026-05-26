export type WeaponKind =
  | 'small'
  | 'pusher'
  | 'shotgun'
  | 'blackHole'
  | 'tractor'
  | 'inspectionProbe';
export type ProjectileKind = Exclude<WeaponKind, 'tractor'>;

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
