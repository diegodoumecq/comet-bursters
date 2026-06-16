import Phaser from 'phaser';

import { withPerformanceMeasure } from '../../core/performance';
import type { Vector, WorldSize } from '../../core/types';
import { wrappedDelta } from '../../world/geometry';
import { prepareStarfieldTextures, Starfield } from '../../world/Starfield';
import {
  SANDBOX_NEBULA_BACKGROUND_TEXTURE_KEY,
  SandboxNebulaBackground,
} from './SandboxNebulaBackground';
import { createSandboxNebulaTexture } from './sandboxNebulaTexture';

const GRID_DEPTH = -100;
const GRID_TILE_SIZE = 240;
const STAR_PARALLAX = 0.018;
const SANDBOX_STAR_DEPTH_SHIFT = -70;

type SandboxBackgroundRenderOptions = {
  grid: boolean;
  markers: boolean;
  nebulaBackground: boolean;
  starfield: boolean;
};

export class SandboxBackground {
  private readonly grid: Phaser.GameObjects.TileSprite;
  private readonly gridTextureKey = getSandboxGridTextureKey();
  private readonly nebula: SandboxNebulaBackground;
  private readonly starfield: Starfield;
  private lastCameraScroll: Vector | null = null;
  private lastRenderAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.nebula = new SandboxNebulaBackground(scene);
    this.starfield = new Starfield(
      scene,
      { width: scene.scale.width, height: scene.scale.height },
      SANDBOX_STAR_DEPTH_SHIFT,
    );
    this.scene.events.once('shutdown', this.dispose, this);
    this.grid = scene.add
      .tileSprite(0, 0, scene.scale.width, scene.scale.height, this.gridTextureKey)
      .setName('sandbox-grid')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(GRID_DEPTH);
  }

  render(world: WorldSize, options: SandboxBackgroundRenderOptions): void {
    const now = this.scene.time.now;
    const deltaMs =
      this.lastRenderAt === 0 ? 0 : Math.min(50, Math.max(0, now - this.lastRenderAt));
    this.lastRenderAt = now;
    const camera = this.scene.cameras.main;
    camera.preRender();
    if (options.nebulaBackground) {
      withPerformanceMeasure('sandbox.render.background.nebula', options.markers, () => {
        this.nebula.render(camera, world, true);
      });
    } else {
      this.nebula.render(camera, world, false);
    }
    this.starfield.setVisible(options.starfield);
    if (options.starfield) {
      withPerformanceMeasure('sandbox.render.background.starfield', options.markers, () => {
        this.starfield.render(now, this.getStarParallax(camera, world), deltaMs);
      });
    }
    this.renderGrid(camera, options.grid);
  }

  private getStarParallax(camera: Phaser.Cameras.Scene2D.Camera, world: WorldSize): Vector {
    const cameraScroll = { x: camera.worldView.x, y: camera.worldView.y };
    if (!this.lastCameraScroll) {
      this.lastCameraScroll = cameraScroll;
      return { x: 0, y: 0 };
    }
    const delta = wrappedDelta(this.lastCameraScroll, cameraScroll, world);
    this.lastCameraScroll = cameraScroll;
    return { x: -delta.x * STAR_PARALLAX, y: -delta.y * STAR_PARALLAX };
  }

  private renderGrid(camera: Phaser.Cameras.Scene2D.Camera, visible: boolean): void {
    this.grid.setVisible(visible);
    if (visible) {
      this.grid.setSize(this.scene.scale.width, this.scene.scale.height);
      this.grid.tilePositionX = positiveModulo(camera.worldView.x, GRID_TILE_SIZE);
      this.grid.tilePositionY = positiveModulo(camera.worldView.y, GRID_TILE_SIZE);
    }
  }

  private dispose(): void {
    this.grid.destroy();
    if (this.scene.textures.exists(this.gridTextureKey))
      this.scene.textures.remove(this.gridTextureKey);
    this.nebula.destroy();
    this.starfield.destroy();
  }
}

export function prepareSandboxBackgroundTextures(
  scene: Phaser.Scene,
  screen: WorldSize,
  options: { nebulaBackground: boolean; starfield: boolean },
): void {
  createGridTexture(scene, getSandboxGridTextureKey());
  if (options.nebulaBackground)
    createSandboxNebulaTexture(scene, SANDBOX_NEBULA_BACKGROUND_TEXTURE_KEY);
  if (options.starfield) prepareStarfieldTextures(scene, screen, SANDBOX_STAR_DEPTH_SHIFT);
}

function createGridTexture(scene: Phaser.Scene, textureKey: string): void {
  if (scene.textures.exists(textureKey)) return;
  const canvas = document.createElement('canvas');
  canvas.width = GRID_TILE_SIZE;
  canvas.height = GRID_TILE_SIZE;
  const context = canvas.getContext('2d');
  if (context) {
    context.globalAlpha = 0.9;
    context.strokeStyle = '#152033';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0.5, 0);
    context.lineTo(0.5, GRID_TILE_SIZE);
    context.moveTo(0, 0.5);
    context.lineTo(GRID_TILE_SIZE, 0.5);
    context.stroke();
    context.globalAlpha = 1;
  }
  scene.textures.addCanvas(textureKey, canvas);
}

function getSandboxGridTextureKey(): string {
  return `sandbox-grid-${GRID_TILE_SIZE}`;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
