import Phaser from 'phaser';

import type { AsteroidEntity, FuelBlobEntity, Vector, WorldSize } from '../model';
import {
  FUEL_BLOB_AMOUNT,
  FUEL_BLOB_ATTRACTION_ACCELERATION,
  FUEL_BLOB_ATTRACTION_RADIUS,
  FUEL_BLOB_DRAG_PER_FRAME,
  FUEL_BLOB_MAX_SPEED,
  FUEL_BLOB_RADIUS,
  getFuelDropCount,
} from './fuel';
import { wrapPoint } from './world';

export function spawnFuelBlobs(
  scene: Phaser.Scene,
  position: Vector,
  baseVelocity: Vector,
  count: number,
): FuelBlobEntity[] {
  const blobs: FuelBlobEntity[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Phaser.Math.FloatBetween(8, 28);
    const speed = Phaser.Math.FloatBetween(21, 66);
    blobs.push({
      shape: scene.add.circle(
        position.x + Math.cos(angle) * distance,
        position.y + Math.sin(angle) * distance,
        FUEL_BLOB_RADIUS,
        0x8cf5ff,
      ),
      velocity: {
        x: baseVelocity.x * 0.12 + Math.cos(angle) * speed,
        y: baseVelocity.y * 0.12 + Math.sin(angle) * speed,
      },
      wobbleSeed: Math.random(),
    });
  }
  return blobs;
}

export function spawnAsteroidFuelDrops(scene: Phaser.Scene, asteroid: AsteroidEntity): FuelBlobEntity[] {
  const count = getFuelDropCount(asteroid.tier);
  return count === 0
    ? []
    : spawnFuelBlobs(
        scene,
        { x: asteroid.body.x, y: asteroid.body.y },
        asteroid.velocity ?? { x: 0, y: 0 },
        count,
      );
}

export function updateFuelBlob(
  blob: FuelBlobEntity,
  player: Vector,
  attractsToPlayer: boolean,
  deltaSeconds: number,
  world: WorldSize,
): void {
  if (attractsToPlayer) {
    const dx = player.x - blob.shape.x;
    const dy = player.y - blob.shape.y;
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
  blob.shape.setPosition(
    blob.shape.x + blob.velocity.x * deltaSeconds,
    blob.shape.y + blob.velocity.y * deltaSeconds,
  );
  wrapPoint(blob.shape, world);
}

export function updateFuelBlobs(
  blobs: FuelBlobEntity[],
  player: Vector,
  canCollect: boolean,
  deltaSeconds: number,
  world: WorldSize,
): { collected: FuelBlobEntity[]; fuelGain: number } {
  const collected: FuelBlobEntity[] = [];
  for (const blob of blobs) {
    updateFuelBlob(blob, player, canCollect, deltaSeconds, world);
    const distance = Phaser.Math.Distance.Between(player.x, player.y, blob.shape.x, blob.shape.y);
    if (canCollect && distance <= 18 + FUEL_BLOB_RADIUS) collected.push(blob);
  }
  return { collected, fuelGain: collected.length * FUEL_BLOB_AMOUNT };
}
