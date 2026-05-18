export type WeaponKind = 'small' | 'pusher' | 'shotgun' | 'blackHole' | 'tractor';
export type ProjectileKind = Exclude<WeaponKind, 'tractor'>;

export type ProjectileSpec = {
  count: number;
  damage: number;
  impact: number;
  lifetimeMs: number;
  radius: number;
  recoil: number;
  speed: number;
  spread: number;
};
