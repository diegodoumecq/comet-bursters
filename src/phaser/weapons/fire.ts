import type { Vector } from '../core/types';
import { createFuelBlob } from '../fuel/factory';
import type { FireMode } from '../fuel/rules';
import { getFireMode, spendWeaponFuel } from '../fuel/rules';
import type { FuelBlobEntity } from '../fuel/types';
import type { ProjectileEntity } from '../projectiles/types';
import { WEAPON_FIRE_CONFIGS } from './config';
import type {
  DischargedWeaponKind,
  FiredEntitySpawn,
  FuelBlobEmissionSpec,
  ProjectileEmissionSpec,
  WeaponKind,
} from './types';

export type FireWeaponInput = {
  direction: Vector;
  fuel: number;
  kind: WeaponKind;
  lastShotAt: Record<DischargedWeaponKind, number>;
  nextProjectileId: number;
  now: number;
  origin: Vector;
  shooterVelocity: Vector;
};

export type FireWeaponResult = {
  fuelBlobs: FuelBlobEntity[];
  fuel: number;
  lastShotAt: Record<DischargedWeaponKind, number>;
  nextProjectileId: number;
  projectiles: ProjectileEntity[];
  recoil: Vector;
};

export function fireWeapon(input: FireWeaponInput): FireWeaponResult {
  if (input.kind === 'tractor') return noShot(input);
  const spec = WEAPON_FIRE_CONFIGS[input.kind];
  if (input.now - input.lastShotAt[input.kind] < spec.fireIntervalMs) return noShot(input);
  const mode = getFireMode(input.fuel, input.kind);
  if (!mode) return noShot(input);

  const baseAngle = Math.atan2(input.direction.y, input.direction.x);
  const projectiles: ProjectileEntity[] = [];
  const fuelBlobs: FuelBlobEntity[] = [];
  let nextProjectileId = input.nextProjectileId;
  for (const emission of spec.emissions) {
    if (emission.type === 'projectile') {
      const fired = createProjectiles({
        baseAngle,
        direction: input.direction,
        emission,
        mode,
        nextProjectileId,
        now: input.now,
        origin: input.origin,
        shooterVelocity: input.shooterVelocity,
      });
      projectiles.push(...fired.projectiles);
      nextProjectileId = fired.nextProjectileId;
    } else {
      fuelBlobs.push(
        ...createFuelBlobs({
          baseAngle,
          direction: input.direction,
          emission,
          now: input.now,
          origin: input.origin,
          shooterVelocity: input.shooterVelocity,
        }),
      );
    }
  }
  return {
    fuel: spendWeaponFuel(input.fuel, input.kind, mode),
    fuelBlobs,
    lastShotAt: { ...input.lastShotAt, [input.kind]: input.now },
    nextProjectileId,
    projectiles,
    recoil: { x: -input.direction.x * spec.recoil, y: -input.direction.y * spec.recoil },
  };
}

function createProjectiles(input: {
  baseAngle: number;
  direction: Vector;
  emission: ProjectileEmissionSpec;
  mode: FireMode;
  nextProjectileId: number;
  now: number;
  origin: Vector;
  shooterVelocity: Vector;
}): { nextProjectileId: number; projectiles: ProjectileEntity[] } {
  const projectiles: ProjectileEntity[] = [];
  const modeScale = input.mode === 'degraded' ? input.emission.degraded : undefined;
  const lifetimeScale = modeScale?.lifetimeScale ?? 1;
  const speedScale = modeScale?.speedScale ?? 1;
  for (const spawn of createEntitySpawns({
    baseAngle: input.baseAngle,
    count: input.emission.count,
    direction: input.direction,
    origin: input.origin,
    speed: input.emission.speed * speedScale,
    speedVariance: input.emission.speedVariance,
    spawnOffset: input.emission.spawnOffset,
    spread: input.emission.spread,
    shooterVelocity: input.emission.inheritShooterVelocity ? input.shooterVelocity : { x: 0, y: 0 },
    volleys: input.emission.volleys ?? 1,
  })) {
    projectiles.push({
      ...input.emission.entity,
      angle: spawn.angle,
      baseSpeed: input.emission.speed,
      createdAt: input.now,
      id: input.nextProjectileId + projectiles.length,
      lifetimeMs:
        input.emission.entity.lifetimeMs *
        lifetimeScale *
        getLifetimeVarianceScale(input.emission.lifetimeVariance),
      position: spawn.position,
      velocity: spawn.velocity,
    });
  }
  return {
    nextProjectileId: input.nextProjectileId + projectiles.length,
    projectiles,
  };
}

function createFuelBlobs(input: {
  baseAngle: number;
  direction: Vector;
  emission: FuelBlobEmissionSpec;
  now: number;
  origin: Vector;
  shooterVelocity: Vector;
}): FuelBlobEntity[] {
  const blobs: FuelBlobEntity[] = [];
  for (const spawn of createEntitySpawns({
    baseAngle: input.baseAngle,
    count: input.emission.count,
    direction: input.direction,
    origin: input.origin,
    speed: input.emission.speed,
    spawnOffset: input.emission.spawnOffset,
    spread: input.emission.spread,
    shooterVelocity: input.emission.inheritShooterVelocity ? input.shooterVelocity : { x: 0, y: 0 },
    volleys: 1,
  })) {
    const blob = createFuelBlob(spawn.position, spawn.velocity, input.emission.entity);
    if (input.emission.entity?.collectableAtMs !== undefined)
      blob.collectableAtMs = input.emission.entity.collectableAtMs;
    if (input.emission.entity?.collectableDelayMs !== undefined)
      blob.collectableAtMs = input.now + input.emission.entity.collectableDelayMs;
    blobs.push(blob);
  }
  return blobs;
}

function createEntitySpawns(input: {
  baseAngle: number;
  count: number;
  direction: Vector;
  origin: Vector;
  speed: number;
  speedVariance?: number;
  spawnOffset: number;
  spread: number;
  shooterVelocity: Vector;
  volleys: number;
}): FiredEntitySpawn[] {
  const spawns: FiredEntitySpawn[] = [];
  const position = getSpawnPosition(input.origin, input.direction, input.spawnOffset);
  for (let volley = 0; volley < input.volleys; volley += 1) {
    for (let index = 0; index < input.count; index += 1) {
      const offset =
        input.count === 1 ? 0 : (index / (input.count - 1) - 0.5) * input.spread;
      const angle = input.baseAngle + offset;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const speed = getEntitySpeed(input.speed, input.speedVariance ?? 0);
      spawns.push({
        angle,
        position: { ...position },
        velocity: {
          x: input.shooterVelocity.x + direction.x * speed,
          y: input.shooterVelocity.y + direction.y * speed,
        },
      });
    }
  }
  return spawns;
}

function getSpawnPosition(origin: Vector, direction: Vector, distance: number): Vector {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude <= 0) return { ...origin };
  return {
    x: origin.x + (direction.x / magnitude) * distance,
    y: origin.y + (direction.y / magnitude) * distance,
  };
}

function getEntitySpeed(speed: number, variance: number): number {
  if (variance <= 0) return speed;
  return speed * (1 - variance + Math.random() * variance * 2);
}

function getLifetimeVarianceScale(
  variance: ProjectileEmissionSpec['lifetimeVariance'],
): number {
  if (!variance) return 1;
  return variance.minScale + Math.random() * (variance.maxScale - variance.minScale);
}

function noShot(input: FireWeaponInput): FireWeaponResult {
  return {
    fuel: input.fuel,
    fuelBlobs: [],
    lastShotAt: input.lastShotAt,
    nextProjectileId: input.nextProjectileId,
    projectiles: [],
    recoil: { x: 0, y: 0 },
  };
}
