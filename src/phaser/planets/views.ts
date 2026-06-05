import Phaser from 'phaser';

import type { Vector } from '../core/types';
import { getPlanetDisplaySize, getPlanetTextureKey } from './textures';
import type { PlanetEntity } from './types';

export class PlanetViews {
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(planet: PlanetEntity): Phaser.GameObjects.Image {
    const existing = this.sprites.get(planet.id);
    if (existing) return existing;

    const textureKey = getPlanetTextureKey(this.scene, planet);
    const size = getPlanetDisplaySize(planet);
    const sprite = this.scene.add
      .image(planet.position.x, planet.position.y, textureKey)
      .setDisplaySize(size, size)
      .setRotation(planet.rotation);
    this.sprites.set(planet.id, sprite);
    return sprite;
  }

  ensureNear(planets: PlanetEntity[], center: Vector, loadRadius: number): void {
    for (const planet of planets) {
      const planetRadius = getPlanetDisplaySize(planet) * 0.5;
      const distance = loadRadius + planetRadius;
      if (getDistanceSquared(planet.position, center) <= distance * distance) {
        this.add(planet);
      }
    }
  }

  sync(planet: PlanetEntity): void {
    const sprite = this.sprites.get(planet.id);
    if (!sprite) return;
    sprite.setPosition(planet.position.x, planet.position.y);
    sprite.setRotation(planet.rotation);
  }
}

function getDistanceSquared(a: Vector, b: Vector): number {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return x * x + y * y;
}
