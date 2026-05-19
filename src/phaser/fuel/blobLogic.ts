import Phaser from 'phaser';

import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import type { FuelBlobEntity } from './types';
import {
  FUEL_BLOB_AMOUNT,
  FUEL_BLOB_ATTRACTION_ACCELERATION,
  FUEL_BLOB_ATTRACTION_RADIUS,
  FUEL_BLOB_DRAG_PER_FRAME,
  FUEL_BLOB_MAX_SPEED,
  FUEL_BLOB_RADIUS,
  getFuelDropCount,
} from './rules';
import { wrapPoint } from '../world/geometry';

let nextFuelBlobId = 1;

export function createFuelBlob(position: Vector, velocity: Vector): FuelBlobEntity {
  return {
    id: nextFuelBlobId++,
    position: { ...position },
    velocity: { ...velocity },
    wobbleSeed: Math.random(),
  };
}

export function spawnFuelBlobs(
  position: Vector,
  baseVelocity: Vector,
  count: number,
): FuelBlobEntity[] {
  const blobs: FuelBlobEntity[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Phaser.Math.FloatBetween(8, 28);
    const speed = Phaser.Math.FloatBetween(21, 66);
    blobs.push(createFuelBlob(
      {
        x: position.x + Math.cos(angle) * distance,
        y: position.y + Math.sin(angle) * distance,
      },
      {
        x: baseVelocity.x * 0.12 + Math.cos(angle) * speed,
        y: baseVelocity.y * 0.12 + Math.sin(angle) * speed,
      },
    ));
  }
  return blobs;
}

export function spawnAsteroidFuelDrops(asteroid: AsteroidEntity): FuelBlobEntity[] {
  const count = getFuelDropCount(asteroid.tier);
  return count === 0
    ? []
    : spawnFuelBlobs(asteroid.position, asteroid.velocity, count);
}

export function updateFuelBlob(
  blob: FuelBlobEntity,
  player: Vector,
  attractsToPlayer: boolean,
  deltaSeconds: number,
  world: WorldSize,
  wrap = true,
): void {
  if (attractsToPlayer) {
    const dx = player.x - blob.position.x;
    const dy = player.y - blob.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && distance < FUEL_BLOB_ATTRACTION_RADIUS) {
      const pull = 1 - distance / FUEL_BLOB_ATTRACTION_RADIUS;
      blob.velocity.x += (dx / distance) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull) * deltaSeconds;
      blob.velocity.y += (dy / distance) * FUEL_BLOB_ATTRACTION_ACCELERATION * (0.35 + pull) * deltaSeconds;
    }
  }

  const frameScale = deltaSeconds * 60;
  const drag = Math.pow(FUEL_BLOB_DRAG_PER_FRAME, frameScale);
  blob.velocity.x *= drag;
  blob.velocity.y *= drag;
  const speed = Math.hypot(blob.velocity.x, blob.velocity.y);
  if (speed > FUEL_BLOB_MAX_SPEED) {
    blob.velocity.x = (blob.velocity.x / speed) * FUEL_BLOB_MAX_SPEED;
    blob.velocity.y = (blob.velocity.y / speed) * FUEL_BLOB_MAX_SPEED;
  }
  blob.position.x += blob.velocity.x * deltaSeconds;
  blob.position.y += blob.velocity.y * deltaSeconds;
  if (wrap) wrapPoint(blob.position, world);
}

export function updateFuelBlobs(
  blobs: FuelBlobEntity[],
  player: Vector,
  canCollect: boolean,
  deltaSeconds: number,
  world: WorldSize,
  wrap = true,
): { collected: FuelBlobEntity[]; fuelGain: number } {
  const collected: FuelBlobEntity[] = [];
  for (const blob of blobs) {
    updateFuelBlob(blob, player, canCollect, deltaSeconds, world, wrap);
    const distance = Phaser.Math.Distance.Between(player.x, player.y, blob.position.x, blob.position.y);
    if (canCollect && distance <= 18 + FUEL_BLOB_RADIUS) collected.push(blob);
  }
  return { collected, fuelGain: collected.length * FUEL_BLOB_AMOUNT };
}
