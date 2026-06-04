import Phaser from 'phaser';

import type { AsteroidEntity } from '../asteroids/types';
import { circlesOverlap } from '../core/collision';
import type { Vector, WorldSize } from '../core/types';
import { PLAYER_COLLISION_RADIUS } from '../player/config';
import { wrapPoint } from '../world/geometry';
import {
  FUEL_BLOB_AMOUNT,
  FUEL_BLOB_ATTRACTION_ACCELERATION,
  FUEL_BLOB_ATTRACTION_RADIUS,
  FUEL_BLOB_CHAIN_REACTION_RADIUS,
  FUEL_BLOB_RADIUS,
  FUEL_BLOB_SPAWN_DRIFT_SPEED,
} from './definition';
import { createFuelBlob } from './factory';
import { getFuelDropCount } from './rules';
import type { FuelBlobEntity } from './types';

export { createFuelBlob };

export function isFuelBlobCollectable(blob: FuelBlobEntity, now: number): boolean {
  return blob.collectableAtMs === undefined || now >= blob.collectableAtMs;
}

export function spawnFuelBlobs(position: Vector, count: number): FuelBlobEntity[] {
  const blobs: FuelBlobEntity[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Phaser.Math.FloatBetween(8, 28);
    const speed = Phaser.Math.FloatBetween(0, FUEL_BLOB_SPAWN_DRIFT_SPEED);
    blobs.push(
      createFuelBlob(
        {
          x: position.x + Math.cos(angle) * distance,
          y: position.y + Math.sin(angle) * distance,
        },
        {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        },
      ),
    );
  }
  return blobs;
}

export function spawnAsteroidFuelDrops(asteroid: AsteroidEntity): FuelBlobEntity[] {
  const count = getFuelDropCount(asteroid.tier);
  return count === 0 ? [] : spawnFuelBlobs(asteroid.position, count);
}

export function updateFuelBlob(
  blob: FuelBlobEntity,
  player: Vector,
  attractsToPlayer: boolean,
  deltaSeconds: number,
  world: WorldSize,
  wrap = true,
): void {
  applyFuelBlobMotion(blob, player, attractsToPlayer, deltaSeconds);
  const frameScale = deltaSeconds * 60;
  blob.position.x += blob.velocity.x * frameScale;
  blob.position.y += blob.velocity.y * frameScale;
  if (wrap) wrapPoint(blob.position, world);
}

export function applyFuelBlobMotion(
  blob: FuelBlobEntity,
  player: Vector,
  attractsToPlayer: boolean,
  deltaSeconds: number,
): void {
  if (attractsToPlayer) {
    const dx = player.x - blob.position.x;
    const dy = player.y - blob.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && distance < FUEL_BLOB_ATTRACTION_RADIUS) {
      const pull = 1 - distance / FUEL_BLOB_ATTRACTION_RADIUS;
      blob.velocity.x +=
        (dx / distance) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull) * deltaSeconds;
      blob.velocity.y +=
        (dy / distance) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull) * deltaSeconds;
    }
  }

  applyFuelBlobDrag(blob.velocity, deltaSeconds, blob.airResistance);
}

export function syncFuelBlobFromBody(
  blob: FuelBlobEntity,
  body: { body: MatterJS.BodyType; x: number; y: number },
): void {
  blob.position = { x: body.x, y: body.y };
  blob.velocity = { x: body.body.velocity.x, y: body.body.velocity.y };
}

export function syncFuelBlobVelocityToBody(
  blob: FuelBlobEntity,
  body: { setVelocity: (x: number, y: number) => void },
): void {
  body.setVelocity(blob.velocity.x, blob.velocity.y);
}

export function getFuelBlobExplosionChain(input: {
  blobs: FuelBlobEntity[];
  getDistance?: (from: Vector, to: Vector) => number;
  origin: FuelBlobEntity;
  radius?: number;
}): FuelBlobEntity[] {
  const getDistance =
    input.getDistance ?? ((from: Vector, to: Vector) => Math.hypot(to.x - from.x, to.y - from.y));
  const radius = input.radius ?? FUEL_BLOB_CHAIN_REACTION_RADIUS;
  const exploded: FuelBlobEntity[] = [];
  const explodedIds = new Set<number>();
  const pending = [input.origin];
  for (let pendingIndex = 0; pendingIndex < pending.length; pendingIndex += 1) {
    const current = pending[pendingIndex];
    if (!explodedIds.has(current.id)) {
      explodedIds.add(current.id);
      exploded.push(current);
      for (const candidate of input.blobs) {
        if (
          !explodedIds.has(candidate.id) &&
          getDistance(current.position, candidate.position) <= radius
        ) {
          pending.push(candidate);
        }
      }
    }
  }
  return exploded;
}

function applyFuelBlobDrag(
  velocity: Vector,
  deltaSeconds: number,
  airResistance: number,
): Vector {
  const frameScale = deltaSeconds * 60;
  const drag = Math.pow(1 - airResistance, frameScale);
  velocity.x *= drag;
  velocity.y *= drag;
  return velocity;
}

export function updateFuelBlobs(
  blobs: FuelBlobEntity[],
  player: Vector,
  canCollect: boolean,
  deltaSeconds: number,
  world: WorldSize,
  wrap = true,
  playerCollisionRadius = PLAYER_COLLISION_RADIUS,
): { collected: FuelBlobEntity[]; fuelGain: number } {
  const collected: FuelBlobEntity[] = [];
  for (const blob of blobs) {
    updateFuelBlob(blob, player, canCollect, deltaSeconds, world, wrap);
    const distance = Phaser.Math.Distance.Between(
      player.x,
      player.y,
      blob.position.x,
      blob.position.y,
    );
    if (canCollect && circlesOverlap(distance, playerCollisionRadius, FUEL_BLOB_RADIUS))
      collected.push(blob);
  }
  return { collected, fuelGain: collected.length * FUEL_BLOB_AMOUNT };
}
