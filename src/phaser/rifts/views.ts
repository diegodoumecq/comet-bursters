import Phaser from 'phaser';

import { ASTEROIDS } from '../asteroids/logic';
import { ASTEROID_TEXTURES } from '../asteroids/textures';
import type { AsteroidEntity } from '../asteroids/types';
import { getRiftSourceLocalPosition } from './geometry';
import { isVisibleInPortal } from './sourceSpace';
import type { RiftProjection } from './types';

export class RiftAsteroidViews {
  private readonly sourceCanvas: HTMLCanvasElement;
  private readonly sourceContext: CanvasRenderingContext2D | null;

  constructor(private readonly scene: Phaser.Scene) {
    this.sourceCanvas = document.createElement('canvas');
    this.sourceContext = this.sourceCanvas.getContext('2d');
  }

  getSourceCanvas(): HTMLCanvasElement {
    return this.sourceCanvas;
  }

  render(projections: RiftProjection[], width: number, height: number): void {
    this.resize(width, height);
    this.sourceContext?.clearRect(0, 0, width, height);
    for (const projection of projections) {
      this.drawSourceAsteroid(projection);
    }
  }

  remove(asteroid: AsteroidEntity): void {
    void asteroid;
  }

  destroy(): void {}

  private resize(width: number, height: number): void {
    if (this.sourceCanvas.width === width && this.sourceCanvas.height === height) return;
    this.sourceCanvas.width = width;
    this.sourceCanvas.height = height;
  }

  private drawSourceAsteroid(projection: RiftProjection): void {
    if (!this.sourceContext) return;
    const sourceAsteroid = projection.sourceAsteroid;
    const asteroid = sourceAsteroid.asteroid;
    const localPosition = getRiftSourceLocalPosition(
      projection.portal,
      sourceAsteroid.sourcePosition,
    );
    if (!isVisibleInPortal(asteroid, localPosition, projection.portal)) return;
    const textureKey = ASTEROID_TEXTURES[asteroid.tier][asteroid.visualVariant];
    const texture = this.scene.textures.get(textureKey);
    const frame = texture.getSourceImage() as CanvasImageSource;
    const radius = ASTEROIDS[asteroid.tier].radius;
    this.sourceContext.save();
    this.sourceContext.drawImage(
      frame,
      projection.scenePosition.x - radius,
      projection.scenePosition.y - radius,
      radius * 2,
      radius * 2,
    );
    this.sourceContext.restore();
  }
}
