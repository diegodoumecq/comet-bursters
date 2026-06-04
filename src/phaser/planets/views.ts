import Phaser from 'phaser';

import { getPlanetDisplaySize, getPlanetTextureKey } from './textures';
import type { PlanetEntity } from './types';

export class PlanetViews {
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(planet: PlanetEntity): Phaser.GameObjects.Image {
    const textureKey = getPlanetTextureKey(this.scene, planet);
    const size = getPlanetDisplaySize(planet);
    const sprite = this.scene.add
      .image(planet.position.x, planet.position.y, textureKey)
      .setDisplaySize(size, size)
      .setRotation(planet.rotation);
    this.sprites.set(planet.id, sprite);
    return sprite;
  }

  sync(planet: PlanetEntity): void {
    const sprite = this.sprites.get(planet.id);
    if (!sprite) throw new Error(`Missing planet sprite ${planet.id}`);
    sprite.setPosition(planet.position.x, planet.position.y);
    sprite.setRotation(planet.rotation);
  }
}
