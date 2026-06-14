import Phaser from 'phaser';

import { getArcadeNebulaPalette } from '../arcade/nebulaPalette';
import type { Vector, WorldSize } from '../core/types';
import {
  SpaceBackgroundRenderer,
  type SpaceBackgroundColor,
  type SpaceNebulaPalette,
} from './SpaceBackgroundRenderer';
import { Starfield } from './Starfield';

const GRID_DEPTH = -100;
const GRID_SPACING = 240;
const MAX_DELTA_MS = 50;
const NEBULA_DRIFT_SPEED = 0.014;
const RIFT_STAR_SEED_OFFSET = 20_000;

export class DimensionBackground {
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly paletteIndex = Phaser.Math.Between(1, 64);
  private readonly shader: SpaceBackgroundRenderer;
  private readonly starfield: Starfield;
  private drift: Vector = { x: NEBULA_DRIFT_SPEED * 0.35, y: -NEBULA_DRIFT_SPEED };
  private lastRenderAt = 0;
  private shaderOffset: Vector = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private screen: WorldSize,
    private readonly mode: 'arcade' | 'rift',
  ) {
    this.shader = new SpaceBackgroundRenderer(scene.game.canvas, scene.game.canvas.parentElement);
    this.starfield = new Starfield(scene, screen, 0, mode === 'rift' ? RIFT_STAR_SEED_OFFSET : 0);
    this.grid = scene.add.graphics().setDepth(GRID_DEPTH);
    this.drawGrid();
    this.scene.events.once('shutdown', this.dispose, this);
  }

  render(
    now: number,
    options: { grid: boolean; starfield: boolean; threeBackground: boolean },
  ): void {
    const deltaMs =
      this.lastRenderAt === 0 ? 0 : Math.min(MAX_DELTA_MS, Math.max(0, now - this.lastRenderAt));
    this.lastRenderAt = now;
    this.shaderOffset.x += this.drift.x * deltaMs;
    this.shaderOffset.y += this.drift.y * deltaMs;
    this.shader.setVisible(options.threeBackground);
    if (options.threeBackground) {
      this.shader.render({
        mode: this.mode,
        nebulaPalette: this.getNebulaPalette(),
        now,
        playerPosition: this.shaderOffset,
        screen: this.screen,
      });
    }
    this.starfield.setVisible(options.starfield);
    if (options.starfield) this.starfield.render(now, this.drift, deltaMs);
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

  hide(): void {
    this.shader.setVisible(false);
    this.starfield.setVisible(false);
    this.grid.setVisible(false);
  }

  private dispose(): void {
    this.shader.dispose();
    this.starfield.destroy();
    this.grid.destroy();
  }

  private drawGrid(): void {
    this.grid.clear();
    this.grid.lineStyle(1, this.mode === 'rift' ? 0x2d1838 : 0x152033, 0.7);
    for (let x = 0; x <= this.screen.width; x += GRID_SPACING) {
      this.grid.lineBetween(x, 0, x, this.screen.height);
    }
    for (let y = 0; y <= this.screen.height; y += GRID_SPACING) {
      this.grid.lineBetween(0, y, this.screen.width, y);
    }
  }

  private getNebulaPalette(): SpaceNebulaPalette {
    const palette = getArcadeNebulaPalette(this.paletteIndex);
    if (this.mode !== 'rift') return palette;
    return {
      base: shiftColorToRift(palette.base, 0.42),
      secondary: shiftColorToRift(palette.secondary, 0.5),
      accent: shiftColorToRift(palette.accent, 0.62),
      thread: shiftColorToRift(palette.thread, 0.68),
    };
  }
}

function shiftColorToRift(color: SpaceBackgroundColor, amount: number): SpaceBackgroundColor {
  const target = { r: 0.9, g: 0.18, b: 0.72 };
  return {
    r: Phaser.Math.Linear(color.r, target.r, amount),
    g: Phaser.Math.Linear(color.g, target.g, amount * 0.45),
    b: Phaser.Math.Linear(color.b, target.b, amount),
  };
}
