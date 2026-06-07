import Phaser from 'phaser';

import { withPerformanceMeasure } from '../../core/performance';
import type { Vector, WorldSize } from '../../core/types';
import { wrappedDelta } from '../../world/geometry';
import { SpaceBackgroundRenderer } from '../../world/SpaceBackgroundRenderer';
import { Starfield } from '../../world/Starfield';

const GRID_DEPTH = -100;
const GRID_TILE_SIZE = 240;
const STAR_PARALLAX = 0.018;
const SANDBOX_STAR_DEPTH_SHIFT = -70;

type SandboxBackgroundRenderOptions = {
  grid: boolean;
  markers: boolean;
  starfield: boolean;
  threeBackground: boolean;
};

export class SandboxBackground {
  private readonly grid: Phaser.GameObjects.TileSprite;
  private readonly gridTextureKey = `sandbox-grid-${Phaser.Math.RND.uuid()}`;
  private readonly shader: SpaceBackgroundRenderer;
  private readonly starfield: Starfield;
  private lastCameraScroll: Vector | null = null;
  private lastRenderAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.shader = new SpaceBackgroundRenderer(scene.game.canvas, scene.game.canvas.parentElement);
    this.starfield = new Starfield(
      scene,
      { width: scene.scale.width, height: scene.scale.height },
      SANDBOX_STAR_DEPTH_SHIFT,
    );
    this.scene.events.once('shutdown', this.dispose, this);
    this.createGridTexture();
    this.grid = scene.add
      .tileSprite(0, 0, scene.scale.width, scene.scale.height, this.gridTextureKey)
      .setName('sandbox-grid')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(GRID_DEPTH);
  }

  render(playerPosition: Vector, world: WorldSize, options: SandboxBackgroundRenderOptions): void {
    const now = this.scene.time.now;
    const deltaMs =
      this.lastRenderAt === 0 ? 0 : Math.min(50, Math.max(0, now - this.lastRenderAt));
    this.lastRenderAt = now;
    const camera = this.scene.cameras.main;
    camera.preRender();
    this.shader.setVisible(options.threeBackground);
    if (options.threeBackground) {
      withPerformanceMeasure('sandbox.render.background.three', options.markers, () => {
        this.shader.render({
          mode: 'sandbox',
          now,
          cameraScroll: {
            x: camera.worldView.x,
            y: camera.worldView.y,
          },
          cameraZoom: camera.zoom,
          playerPosition,
          screen: { width: this.scene.scale.width, height: this.scene.scale.height },
          world,
        });
      });
    }
    this.starfield.setVisible(options.starfield);
    if (options.starfield) {
      withPerformanceMeasure('sandbox.render.background.starfield', options.markers, () => {
        this.starfield.render(now, this.getStarParallax(camera, world), deltaMs);
      });
    }
    this.renderGrid(camera, options.grid);
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.shader.getCanvas();
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

  private createGridTexture(): void {
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
    this.scene.textures.addCanvas(this.gridTextureKey, canvas);
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
    if (this.scene.textures.exists(this.gridTextureKey)) this.scene.textures.remove(this.gridTextureKey);
    this.shader.dispose();
    this.starfield.destroy();
  }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
