import Phaser from 'phaser';

import type { FuelBlobEntity, Vector, WorldSize } from '../model';
import {
  FUEL_BLOB_ATTRACTION_ACCELERATION,
  FUEL_BLOB_ATTRACTION_RADIUS,
  FUEL_BLOB_DRAG_PER_FRAME,
  FUEL_BLOB_MAX_SPEED,
  FUEL_BLOB_RADIUS,
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
