import Phaser from 'phaser';

import { withPerformanceMeasure } from '../../core/performance';
import type { Vector, WorldSize } from '../../core/types';
import { wrappedDelta } from '../../world/geometry';
import { SpaceBackgroundRenderer } from '../../world/SpaceBackgroundRenderer';
import { Starfield } from '../../world/Starfield';

const GRID_DEPTH = -100;
const STAR_PARALLAX = 0.018;
const SANDBOX_STAR_DEPTH_SHIFT = -70;

type SandboxBackgroundRenderOptions = {
  grid: boolean;
  markers: boolean;
  starfield: boolean;
  threeBackground: boolean;
};

export class SandboxBackground {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly shader: SpaceBackgroundRenderer;
  private readonly starfield: Starfield;
  private lastPlayerPosition: Vector | null = null;
  private lastRenderAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    world: WorldSize,
  ) {
    this.shader = new SpaceBackgroundRenderer(scene.game.canvas, scene.game.canvas.parentElement);
    this.starfield = new Starfield(
      scene,
      { width: scene.scale.width, height: scene.scale.height },
      SANDBOX_STAR_DEPTH_SHIFT,
    );
    this.scene.events.once('shutdown', this.dispose, this);
    this.graphics = scene.add.graphics().setDepth(GRID_DEPTH);
    this.drawGrid(world);
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
        this.starfield.render(now, this.getStarParallax(playerPosition, world), deltaMs);
      });
    }
    this.graphics.setVisible(options.grid);
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.shader.getCanvas();
  }

  private getStarParallax(playerPosition: Vector, world: WorldSize): Vector {
    if (!this.lastPlayerPosition) {
      this.lastPlayerPosition = { x: playerPosition.x, y: playerPosition.y };
      return { x: 0, y: 0 };
    }
    const delta = wrappedDelta(this.lastPlayerPosition, playerPosition, world);
    this.lastPlayerPosition = { x: playerPosition.x, y: playerPosition.y };
    return { x: -delta.x * STAR_PARALLAX, y: -delta.y * STAR_PARALLAX };
  }

  private drawGrid(world: WorldSize): void {
    this.graphics.lineStyle(1, 0x152033, 0.9);
    for (let x = 0; x <= world.width; x += 240) this.graphics.lineBetween(x, 0, x, world.height);
    for (let y = 0; y <= world.height; y += 240) this.graphics.lineBetween(0, y, world.width, y);
  }

  private dispose(): void {
    this.shader.dispose();
    this.starfield.destroy();
  }
}
