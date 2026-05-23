import Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';
import { SpaceBackgroundRenderer } from '../../world/SpaceBackgroundRenderer';
import { Starfield } from '../../world/Starfield';

const GRID_DEPTH = -100;
const SANDBOX_STAR_DEPTH_SHIFT = -70;

export class SandboxBackground {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly shader: SpaceBackgroundRenderer;
  private readonly starfield: Starfield;
  private lastRenderAt = 0;

  constructor(private readonly scene: Phaser.Scene, world: WorldSize) {
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

  render(playerPosition: Vector, world: WorldSize): void {
    const now = this.scene.time.now;
    const deltaMs =
      this.lastRenderAt === 0 ? 0 : Math.min(50, Math.max(0, now - this.lastRenderAt));
    this.lastRenderAt = now;
    this.shader.render({
      mode: 'sandbox',
      now,
      playerPosition,
      screen: { width: this.scene.scale.width, height: this.scene.scale.height },
      world,
    });
    this.starfield.render(now, { x: 0, y: 0 }, deltaMs);
    this.graphics.setVisible(true);
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
