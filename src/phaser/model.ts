import type Phaser from 'phaser';

export type WeaponKind = 'small' | 'pusher' | 'shotgun' | 'blackHole' | 'tractor';
export type ProjectileKind = Exclude<WeaponKind, 'tractor'>;

export type ProjectileSpec = {
  damage: number;
  impact: number;
  lifetimeMs: number;
  radius: number;
  speed: number;
};

export type WorldSize = {
  width: number;
  height: number;
};

export type Vector = {
  x: number;
  y: number;
};

export type AsteroidTier = 'small' | 'medium' | 'big' | 'mega';

export type AsteroidEntity = {
  body: Phaser.Physics.Matter.Image;
  hits?: number;
  tier: AsteroidTier;
  velocity?: Vector;
};

export type PlanetEntity = {
  body: Phaser.GameObjects.Arc;
  radius: number;
};

export type ProjectileEntity = {
  absorbedFuel: number;
  collapseStartedAt: number | null;
  createdAt: number;
  kind: ProjectileKind;
  shape: Phaser.GameObjects.Arc;
  velocity: Vector;
};
