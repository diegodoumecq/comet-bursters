import Phaser from 'phaser';

import type { WorldSize } from '../../core/types';

export class SandboxBackground {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, world: WorldSize) {
    this.graphics = scene.add.graphics().setDepth(-100);
    this.drawGrid(world);
  }

  render(): void {
    this.graphics.setVisible(true);
  }

  private drawGrid(world: WorldSize): void {
    this.graphics.lineStyle(1, 0x152033, 0.9);
    for (let x = 0; x <= world.width; x += 240) this.graphics.lineBetween(x, 0, x, world.height);
    for (let y = 0; y <= world.height; y += 240) this.graphics.lineBetween(0, y, world.width, y);
  }
}
