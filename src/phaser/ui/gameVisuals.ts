import Phaser from 'phaser';

import type { Vector, WorldSize } from '../model';
import { createAsteroidTextures } from '../services/asteroids';
import { SHIELD_RADIUS } from '../services/fuel';

export function createGameBackground(scene: Phaser.Scene, world: WorldSize): void {
  const graphics = scene.add.graphics();
  graphics.lineStyle(1, 0x1f2a44, 0.7);
  for (let x = 0; x <= world.width; x += 120) graphics.lineBetween(x, 0, x, world.height);
  for (let y = 0; y <= world.height; y += 120) graphics.lineBetween(0, y, world.width, y);
}

export function createGameTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('phaser-ship')) return;
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  graphics.fillStyle(0xf4f7ff, 1);
  graphics.beginPath();
  graphics.moveTo(24, 0);
  graphics.lineTo(40, 44);
  graphics.lineTo(24, 36);
  graphics.lineTo(8, 44);
  graphics.closePath();
  graphics.fillPath();
  graphics.generateTexture('phaser-ship', 48, 48);
  graphics.destroy();
  createAsteroidTextures(scene);
}

export function drawShield(
  graphics: Phaser.GameObjects.Graphics,
  center: Vector,
  active: boolean,
  visible: boolean,
): void {
  graphics.clear();
  if (!active || !visible) return;
  graphics.lineStyle(3, 0x64c8ff, 0.75);
  graphics.strokeCircle(center.x, center.y, SHIELD_RADIUS);
}

export function updatePlayerBlink(player: Phaser.GameObjects.Components.Visible, alive: boolean, invulnerableUntil: number, now: number): void {
  if (!alive) return;
  const invulnerable = now < invulnerableUntil;
  player.setVisible(!invulnerable || Math.floor(now / 120) % 2 === 0);
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

export function createGameOverText(scene: Phaser.Scene, world: WorldSize): Phaser.GameObjects.Text {
  return scene.add.text(world.width * 0.5, world.height * 0.5, 'GAME OVER\nfire to restart', {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: '42px',
    align: 'center',
  }).setOrigin(0.5).setDepth(120).setScrollFactor(0);
}
