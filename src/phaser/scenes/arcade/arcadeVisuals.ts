import Phaser from 'phaser';

import { createAsteroidTextures } from '../../asteroids/textures';
import type { WorldSize } from '../../core/types';
import { createPlayerTexture } from '../../player/textures';

export function createArcadeTextures(scene: Phaser.Scene): void {
  createPlayerTexture(scene);
  createAsteroidTextures(scene);
}

export function updateCameraShake(
  camera: Phaser.Cameras.Scene2D.Camera,
  now: number,
  shakeUntil: number,
  shakeIntensity: number,
): { shakeIntensity: number } {
  if (now >= shakeUntil) {
    camera.setScroll(0, 0);
    return { shakeIntensity: 0 };
  }
  camera.setScroll(
    Phaser.Math.FloatBetween(-shakeIntensity, shakeIntensity),
    Phaser.Math.FloatBetween(-shakeIntensity, shakeIntensity),
  );
  return { shakeIntensity };
}

export function createArcadeGameOverText(
  scene: Phaser.Scene,
  world: WorldSize,
): Phaser.GameObjects.Text {
  return scene.add
    .text(world.width * 0.5, world.height * 0.5, 'GAME OVER\nfire to restart', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '42px',
      align: 'center',
    })
    .setOrigin(0.5)
    .setDepth(120)
    .setScrollFactor(0);
}
