import Phaser from 'phaser';

import type { Vector } from '../core/types';
import { getPlanetDisplaySize, getPlanetTextureKeys } from './textures';
import type { PlanetEntity } from './types';

export type PlanetView = {
  lighting: Phaser.GameObjects.Image;
  surface: Phaser.GameObjects.Image;
};

export class PlanetViews {
  private readonly sprites = new Map<number, PlanetView>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(planet: PlanetEntity): PlanetView {
    const existing = this.sprites.get(planet.id);
    if (existing) return existing;

    const textureKeys = getPlanetTextureKeys(this.scene, planet);
    const size = getPlanetDisplaySize(planet);
    const surface = this.scene.add
      .image(planet.position.x, planet.position.y, textureKeys.surface)
      .setDisplaySize(size, size)
      .setRotation(planet.rotation);
    const lighting = this.scene.add
      .image(planet.position.x, planet.position.y, textureKeys.lighting)
      .setDisplaySize(size, size);
    const view = { lighting, surface };
    this.sprites.set(planet.id, view);
    return view;
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
    const view = this.sprites.get(planet.id);
    if (!view) return;
    view.surface.setPosition(planet.position.x, planet.position.y);
    view.surface.setRotation(planet.rotation);
    view.lighting.setPosition(planet.position.x, planet.position.y);
    view.lighting.setRotation(0);
  }
}

function getDistanceSquared(a: Vector, b: Vector): number {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return x * x + y * y;
}
