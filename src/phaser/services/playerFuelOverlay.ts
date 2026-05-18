import Phaser from 'phaser';

import { MAX_FUEL } from './fuel';
import { drawFuelContour } from './playerTextures';

type PlayerFuelOverlayTarget = {
  rotation: number;
  x: number;
  y: number;
};

export class PlayerFuelOverlay {
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly mask: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, depth = 1) {
    this.base = scene.add.graphics().setDepth(depth);
    this.fill = scene.add.graphics().setDepth(depth);
    this.mask = scene.make.graphics({ x: 0, y: 0 }, false);
    this.fill.setMask(this.mask.createGeometryMask());
  }

  update(player: PlayerFuelOverlayTarget, fuel: number, now: number, visible = true): void {
    this.base.setVisible(visible);
    this.fill.setVisible(visible);
    this.mask.setVisible(visible);
    if (!visible) return;
    drawFuelContour(
      this.base,
      this.fill,
      this.mask,
      player.x,
      player.y,
      player.rotation,
      Math.max(0, Math.min(1, fuel / MAX_FUEL)),
      now,
    );
  }
}
