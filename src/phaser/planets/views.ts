import Phaser from 'phaser';

import type { PlanetEntity } from './types';

export class PlanetViews {
  private readonly shapes = new Map<number, Phaser.GameObjects.Arc>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(planet: PlanetEntity): Phaser.GameObjects.Arc {
    const shape = this.scene.add.circle(
      planet.position.x,
      planet.position.y,
      planet.radius,
      planet.color,
    ).setStrokeStyle(4, 0xffffff, 0.18);
    this.shapes.set(planet.id, shape);
    return shape;
  }
}
