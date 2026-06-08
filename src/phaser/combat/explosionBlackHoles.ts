import type { Vector } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import { BLACK_HOLE_RADIUS } from '../projectiles/definition';
import type { ProjectileEntity } from '../projectiles/types';

export const FUEL_BLOBS_PER_EXPLOSION_BLACK_HOLE = 8;

export function createBlackHoleFromFuelExplosion(input: {
  blobs: FuelBlobEntity[];
  nextProjectileId: number;
  now: number;
}): ProjectileEntity | null {
  if (input.blobs.length < FUEL_BLOBS_PER_EXPLOSION_BLACK_HOLE) return null;
  const position = getAveragePosition(input.blobs);
  const velocity = getAverageVelocity(input.blobs);
  return createExplosionBlackHole({
    mass: input.blobs.length / FUEL_BLOBS_PER_EXPLOSION_BLACK_HOLE,
    nextProjectileId: input.nextProjectileId,
    now: input.now,
    position,
    velocity,
  });
}

export function createExplosionBlackHole(input: {
  mass: number;
  nextProjectileId: number;
  now: number;
  position: Vector;
  velocity: Vector;
}): ProjectileEntity | null {
  if (input.mass < 1) return null;
  return {
    absorbedFuel: 0,
    ageMs: 0,
    airResistance: 0.01,
    angle: Math.atan2(input.velocity.y, input.velocity.x),
    baseSpeed: Math.hypot(input.velocity.x, input.velocity.y),
    blackHoleMass: Math.max(1, input.mass),
    collapseStartedAt: null,
    createdAt: input.now,
    damage: 0,
    id: input.nextProjectileId,
    impact: 0,
    kind: 'blackHole',
    lifetimeMs: 10000,
    position: { ...input.position },
    radius: BLACK_HOLE_RADIUS,
    velocity: { ...input.velocity },
  };
}

function getAveragePosition(blobs: FuelBlobEntity[]): Vector {
  return getAverageVector(blobs.map((blob) => blob.position));
}

function getAverageVelocity(blobs: FuelBlobEntity[]): Vector {
  return getAverageVector(blobs.map((blob) => blob.velocity));
}

function getAverageVector(vectors: Vector[]): Vector {
  const sum = vectors.reduce(
    (total, vector) => ({
      x: total.x + vector.x,
      y: total.y + vector.y,
    }),
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / vectors.length,
    y: sum.y / vectors.length,
  };
}
