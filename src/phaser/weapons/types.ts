import type { Vector } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ProjectileEntity } from '../projectiles/types';

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

export type ProjectileEntityTemplate = Pick<
  ProjectileEntity,
  | 'absorbedFuel'
  | 'ageMs'
  | 'airResistance'
  | 'collapseStartedAt'
  | 'damage'
  | 'impact'
  | 'kind'
  | 'lifetimeMs'
  | 'radius'
> &
  Partial<Pick<ProjectileEntity, 'blackHoleMass' | 'gravityScale'>>;

export type FuelBlobEntityTemplate = Partial<
  Pick<FuelBlobEntity, 'airResistance' | 'collectableAtMs' | 'gravityScale'>
> & {
  collectableDelayMs?: number;
};

export type ProjectileEmissionDegradedMode = {
  lifetimeScale: number;
  speedScale: number;
};

export type ProjectileEmissionLifetimeVariance = {
  maxScale: number;
  minScale: number;
};

export type ProjectileEmissionSpec = {
  count: number;
  degraded?: ProjectileEmissionDegradedMode;
  entity: ProjectileEntityTemplate;
  inheritShooterVelocity: boolean;
  lifetimeVariance?: ProjectileEmissionLifetimeVariance;
  spawnOffset: number;
  speed: number;
  speedVariance: number;
  spread: number;
  volleys?: number;
};

export type FuelBlobEmissionSpec = {
  count: number;
  entity?: FuelBlobEntityTemplate;
  inheritShooterVelocity: boolean;
  spawnOffset: number;
  speed: number;
  spread: number;
};

export type WeaponEmissionSpec =
  | ({ type: 'fuelBlob' } & FuelBlobEmissionSpec)
  | ({ type: 'projectile' } & ProjectileEmissionSpec);

export type WeaponFireSpec = {
  emissions: readonly WeaponEmissionSpec[];
  fireIntervalMs: number;
  fuelCost: number;
  recoil: number;
};

export type FiredWeaponEntities = {
  fuelBlobs: FuelBlobEntity[];
  projectiles: ProjectileEntity[];
};

export type FiredEntitySpawn = {
  angle: number;
  position: Vector;
  velocity: Vector;
};
