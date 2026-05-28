import Phaser from 'phaser';

import { ASTEROIDS } from '../asteroids/logic';
import { ASTEROID_TEXTURES } from '../asteroids/textures';
import type { AsteroidEntity } from '../asteroids/types';
import { PLAYER_TEXTURE_KEY, PLAYER_VISUAL_SIZE } from '../player/textures';
import type { ProjectileKind } from '../weapons/types';
import { getRiftSourceLocalPosition } from './geometry';
import { isVisibleInPortal } from './sourceSpace';
import type { RiftProjection, RiftSceneProjection } from './types';

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

  render(
    projections: RiftProjection[],
    width: number,
    height: number,
    sceneProjections: RiftSceneProjection[] = [],
  ): void {
    this.resize(width, height);
    this.sourceContext?.clearRect(0, 0, width, height);
    for (const projection of projections) {
      this.drawSourceAsteroid(projection);
    }
    for (const projection of sceneProjections) this.drawSceneProjection(projection);
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

  private drawSceneProjection(projection: RiftSceneProjection): void {
    if (!this.sourceContext) return;
    if (projection.kind === 'player') {
      this.drawPlayerProjection(projection);
    } else {
      this.drawProjectileProjection(projection);
    }
  }

  private drawPlayerProjection(projection: Extract<RiftSceneProjection, { kind: 'player' }>): void {
    if (!this.sourceContext) return;
    const texture = this.scene.textures.get(PLAYER_TEXTURE_KEY);
    const frame = texture.getSourceImage() as CanvasImageSource;
    const size = PLAYER_VISUAL_SIZE * 2 * projection.scale;
    this.sourceContext.save();
    this.sourceContext.translate(projection.scenePosition.x, projection.scenePosition.y);
    this.sourceContext.rotate(projection.rotation);
    this.sourceContext.drawImage(frame, -size * 0.5, -size * 0.5, size, size);
    this.sourceContext.restore();
  }

  private drawProjectileProjection(
    projection: Extract<RiftSceneProjection, { kind: 'projectile' }>,
  ): void {
    if (!this.sourceContext) return;
    this.sourceContext.save();
    this.sourceContext.translate(projection.scenePosition.x, projection.scenePosition.y);
    this.sourceContext.rotate(projection.rotation);
    this.sourceContext.fillStyle = `#${getProjectileTint(projection.projectileKind)
      .toString(16)
      .padStart(6, '0')}`;
    this.sourceContext.beginPath();
    this.sourceContext.ellipse(
      0,
      0,
      projection.radius * 2.1,
      projection.radius * 0.8,
      0,
      0,
      Math.PI * 2,
    );
    this.sourceContext.fill();
    this.sourceContext.restore();
  }
}

function getProjectileTint(projectileKind: ProjectileKind): number {
  if (projectileKind === 'inspectionProbe' || projectileKind === 'pusher') return 0x67e8f9;
  if (projectileKind === 'shotgun') return 0xffd166;
  if (projectileKind === 'blackHole') return 0x000000;
  return 0xffffff;
}
