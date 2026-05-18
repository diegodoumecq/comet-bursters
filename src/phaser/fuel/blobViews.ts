import Phaser from 'phaser';

import type { FuelBlobEntity } from './types';
import { FUEL_BLOB_RADIUS } from './rules';

export class FuelBlobViews {
  private readonly shapes = new Map<number, Phaser.GameObjects.Arc>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(blob: FuelBlobEntity): Phaser.GameObjects.Arc {
    const shape = this.scene.add.circle(blob.position.x, blob.position.y, FUEL_BLOB_RADIUS, 0x8cf5ff);
    this.shapes.set(blob.id, shape);
    return shape;
  }

  get(blob: FuelBlobEntity): Phaser.GameObjects.Arc {
    const shape = this.shapes.get(blob.id);
    if (!shape) throw new Error(`Missing fuel blob shape ${blob.id}`);
    return shape;
  }

  remove(blob: FuelBlobEntity): void {
    this.get(blob).destroy();
    this.shapes.delete(blob.id);
  }

  sync(blob: FuelBlobEntity): void {
    this.get(blob).setPosition(blob.position.x, blob.position.y);
  }
}
