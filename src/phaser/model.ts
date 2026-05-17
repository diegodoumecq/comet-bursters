import type Phaser from 'phaser';

export type MatterImage = Omit<Phaser.Physics.Matter.Image, 'body'> & {
  body: MatterJS.BodyType;
};

export type MatterArc = Phaser.GameObjects.Arc &
  Phaser.Physics.Matter.Components.Velocity & {
    body: MatterJS.BodyType;
  };

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
  body: MatterImage;
  hits?: number;
  tier: AsteroidTier;
  velocity?: Vector;
};

export type PlanetEntity = {
  body: Phaser.GameObjects.Arc;
  gravityStrength: number;
  radius: number;
};

export type ProjectileEntity = {
  absorbedFuel: number;
  collapseStartedAt: number | null;
  createdAt: number;
  kind: ProjectileKind;
  lifetimeMs: number;
  shape: MatterArc;
  velocity: Vector;
};

export type FuelBlobEntity = {
  shape: Phaser.GameObjects.Arc;
  velocity: Vector;
  wobbleSeed: number;
};

export type ParticleEntity = {
  alphaDecayPerSecond: number;
  dragPerSecond: number;
  lifetimeMs: number;
  shape: Phaser.GameObjects.Arc;
  velocity: Vector;
};
