import Phaser from 'phaser';

import { ASTEROIDS } from '../asteroids/logic';
import { PLAYER_COLLISION_RADIUS } from '../player/config';
import type { SpaceWorldRuntime } from '../world/SpaceWorldRuntime';

const DEBUG_DEPTH = 10000;
const DEBUG_RING_PADDING = 10;
const RIFT_COLOR = 0x67e8f9;

export class DimensionDebugOverlay {
  private readonly entityRings: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.entityRings = scene.add.graphics().setDepth(DEBUG_DEPTH);
    this.setVisible(false);
  }

  render(input: { enabled: boolean; runtime: SpaceWorldRuntime }): void {
    if (!input.enabled || input.runtime.space !== 'rift') {
      this.clear();
      return;
    }

    this.entityRings.clear();
    this.entityRings.lineStyle(2, RIFT_COLOR, 0.95);

    for (const asteroid of input.runtime.world.asteroids) {
      this.entityRings.strokeCircle(
        asteroid.position.x,
        asteroid.position.y,
        ASTEROIDS[asteroid.tier].collisionRadius + DEBUG_RING_PADDING,
      );
    }
    for (const projectile of input.runtime.world.projectiles) {
      this.entityRings.strokeCircle(
        projectile.position.x,
        projectile.position.y,
        projectile.radius + DEBUG_RING_PADDING,
      );
    }

    const playerBody = input.runtime.getPlayerBody();
    if (playerBody && input.runtime.hasPlayer()) {
      this.entityRings.strokeCircle(
        playerBody.body.x,
        playerBody.body.y,
        PLAYER_COLLISION_RADIUS + DEBUG_RING_PADDING,
      );
    }
    this.entityRings.setVisible(true);
  }

  destroy(): void {
    this.entityRings.destroy();
  }

  private clear(): void {
    this.entityRings.clear();
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    this.entityRings.setVisible(visible);
  }
}
