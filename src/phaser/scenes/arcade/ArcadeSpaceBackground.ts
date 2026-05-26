import Phaser from 'phaser';

import { withPerformanceMeasure } from '../../core/performance';
import type { Vector, WorldSize } from '../../core/types';
import { SpaceBackgroundRenderer } from '../../world/SpaceBackgroundRenderer';
import { Starfield } from '../../world/Starfield';

const GRID_DEPTH = -100;
const GRID_SPACING = 240;
const MAX_DELTA_MS = 50;
const NEBULA_DIRECTION_CHANGE_MS = 14000;
const NEBULA_DRIFT_SMOOTHING = 0.012;
const NEBULA_DRIFT_SPEED = 0.014;

type ArcadeSpaceBackgroundRenderOptions = {
  grid: boolean;
  markers: boolean;
  starfield: boolean;
  threeBackground: boolean;
};

export class ArcadeSpaceBackground {
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly shader: SpaceBackgroundRenderer;
  private drift: Vector = { x: -NEBULA_DRIFT_SPEED, y: NEBULA_DRIFT_SPEED * 0.45 };
  private lastRenderAt = 0;
  private nextDirectionChangeAt = 0;
  private shaderOffset: Vector = { x: 0, y: 0 };
  private readonly starfield: Starfield;
  private targetDrift: Vector = { x: -NEBULA_DRIFT_SPEED, y: NEBULA_DRIFT_SPEED * 0.45 };

  constructor(
    private readonly scene: Phaser.Scene,
    private screen: WorldSize,
  ) {
    this.shader = new SpaceBackgroundRenderer(scene.game.canvas, scene.game.canvas.parentElement);
    this.starfield = new Starfield(scene, screen);
    this.grid = scene.add.graphics().setDepth(GRID_DEPTH);
    this.drawGrid();
    this.scene.events.once('shutdown', this.dispose, this);
  }

  render(now: number, _playerVelocity: Vector, options: ArcadeSpaceBackgroundRenderOptions): void {
    const deltaMs =
      this.lastRenderAt === 0 ? 0 : Math.min(MAX_DELTA_MS, Math.max(0, now - this.lastRenderAt));
    this.lastRenderAt = now;
    this.updateNebulaDrift(now);
    this.shaderOffset.x += this.drift.x * deltaMs;
    this.shaderOffset.y += this.drift.y * deltaMs;
    this.shader.setVisible(options.threeBackground);
    if (options.threeBackground) {
      withPerformanceMeasure('arcade.render.background.three', options.markers, () => {
        this.shader.render({
          mode: 'arcade',
          now,
          playerPosition: this.shaderOffset,
          screen: this.screen,
        });
      });
    }
    this.starfield.setVisible(options.starfield);
    if (options.starfield) {
      withPerformanceMeasure('arcade.render.background.starfield', options.markers, () => {
        this.starfield.render(now, this.drift, deltaMs);
      });
    }
    this.grid.setVisible(options.grid);
  }

  resize(screen: WorldSize): void {
    this.screen = screen;
    this.starfield.resize(screen);
    this.drawGrid();
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.shader.getCanvas();
  }

  private dispose(): void {
    this.shader.dispose();
    this.starfield.destroy();
    this.grid.destroy();
  }

  private drawGrid(): void {
    this.grid.clear();
    this.grid.lineStyle(1, 0x152033, 0.9);
    for (let x = 0; x <= this.screen.width; x += GRID_SPACING) {
      this.grid.lineBetween(x, 0, x, this.screen.height);
    }
    for (let y = 0; y <= this.screen.height; y += GRID_SPACING) {
      this.grid.lineBetween(0, y, this.screen.width, y);
    }
  }

  private updateNebulaDrift(now: number): void {
    if (this.nextDirectionChangeAt === 0 || now >= this.nextDirectionChangeAt) {
      const bucket = Math.floor(now / NEBULA_DIRECTION_CHANGE_MS);
      const angle = seededUnit(bucket, 113) * Math.PI * 2;
      const speed = Phaser.Math.Linear(
        NEBULA_DRIFT_SPEED * 0.65,
        NEBULA_DRIFT_SPEED * 1.2,
        seededUnit(bucket, 127),
      );
      this.targetDrift = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
      this.nextDirectionChangeAt = now + NEBULA_DIRECTION_CHANGE_MS;
    }
    this.drift.x = Phaser.Math.Linear(this.drift.x, this.targetDrift.x, NEBULA_DRIFT_SMOOTHING);
    this.drift.y = Phaser.Math.Linear(this.drift.y, this.targetDrift.y, NEBULA_DRIFT_SMOOTHING);
  }
}

function seededUnit(index: number, seed: number): number {
  return Math.abs(Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
}
