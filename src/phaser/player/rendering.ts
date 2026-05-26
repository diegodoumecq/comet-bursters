import Phaser from 'phaser';

import type { Vector } from '../core/types';
import { MAX_FUEL, SHIELD_RADIUS } from '../fuel/rules';
import { drawFuelContour, PLAYER_VISUAL_SIZE } from './textures';

type PlayerRenderTarget = {
  rotation: number;
  scale?: number;
  setVisible(visible: boolean): unknown;
  x: number;
  y: number;
};

export function getPlayerVisible(
  visible: boolean,
  invulnerableUntil: number,
  now: number,
): boolean {
  if (!visible) return false;
  const invulnerable = now < invulnerableUntil;
  return !invulnerable || Math.floor(now / 120) % 2 === 0;
}

export function renderPlayerTurret(
  player: PlayerRenderTarget,
  turret: Phaser.GameObjects.Image,
  aim: Vector,
  visible: boolean,
): void {
  player.setVisible(visible);
  turret.setVisible(visible);
  turret.setPosition(player.x, player.y);
  turret.setRotation(Math.atan2(aim.y, aim.x));
  turret.setScale(player.scale ?? 1);
}

export function renderPlayerShield(
  graphics: Phaser.GameObjects.Graphics,
  player: PlayerRenderTarget,
  active: boolean,
  fuel: number,
  visible: boolean,
): void {
  graphics.clear();
  if (!active || !visible || fuel <= 0) return;
  graphics.lineStyle(3, 0x64c8ff, 0.75);
  graphics.strokeCircle(player.x, player.y, SHIELD_RADIUS * (player.scale ?? 1));
}

export function renderPlayerFuel(
  base: Phaser.GameObjects.Graphics,
  fill: Phaser.GameObjects.Graphics,
  mask: Phaser.GameObjects.Graphics,
  player: PlayerRenderTarget,
  fuel: number,
  now: number,
  visible: boolean,
): void {
  base.setVisible(visible);
  fill.setVisible(visible);
  mask.setVisible(visible);
  if (!visible) return;
  drawFuelContour(
    base,
    fill,
    mask,
    player.x,
    player.y,
    player.rotation,
    Math.max(0, Math.min(1, fuel / MAX_FUEL)),
    now,
    player.scale ?? 1,
  );
}

export function renderPlayerThruster(
  graphics: Phaser.GameObjects.Graphics,
  player: PlayerRenderTarget,
  move: Vector,
  fuelAvailable: boolean,
  visible: boolean,
): void {
  graphics.clear();
  graphics.setVisible(visible);
  if (!visible) return;

  const size = PLAYER_VISUAL_SIZE * 0.5 * (player.scale ?? 1);
  const flameLength = fuelAvailable
    ? size * Phaser.Math.FloatBetween(1.2, 1.5)
    : size * Phaser.Math.FloatBetween(0.58, 0.74);
  graphics.setPosition(player.x, player.y);
  graphics.setRotation(Math.atan2(-move.y, -move.x));
  drawThrusterLayer(
    graphics,
    size,
    flameLength,
    fuelAvailable ? 0xfff7cc : 0xdcfaff,
    fuelAvailable ? 0.92 : 0.72,
    0.25,
  );
  drawThrusterLayer(
    graphics,
    size,
    flameLength,
    fuelAvailable ? 0xff8800 : 0x3b82f6,
    fuelAvailable ? 0.54 : 0.22,
    0.16,
  );
}

function drawThrusterLayer(
  graphics: Phaser.GameObjects.Graphics,
  size: number,
  flameLength: number,
  color: number,
  alpha: number,
  width: number,
): void {
  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  graphics.moveTo(size * 0.5, -size * width);
  graphics.lineTo(flameLength, 0);
  graphics.lineTo(size * 0.5, size * width);
  graphics.closePath();
  graphics.fillPath();
}
