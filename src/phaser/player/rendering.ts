import Phaser from 'phaser';

import type { Vector } from '../core/types';
import { MAX_FUEL, SHIELD_RADIUS } from '../fuel/rules';
import type { WeaponKind } from '../weapons/types';
import {
  drawFuelContour,
  getPlayerHullTextureBlend,
  getPlayerTurretTextureKey,
  PLAYER_HULL_DEFAULT_FRAME_KEY,
  PLAYER_TEXTURE_KEY,
  PLAYER_VISUAL_SIZE,
} from './textures';

type PlayerRenderTarget = {
  rotation: number;
  scale?: number;
  setVisible(visible: boolean): unknown;
  x: number;
  y: number;
};

type PlayerHullRenderTarget = PlayerRenderTarget & {
  setVisible(visible: boolean): unknown;
};

export type PlayerHullVisual = {
  current: Phaser.GameObjects.Image;
  next: Phaser.GameObjects.Image;
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
  player: PlayerHullRenderTarget,
  hull: PlayerHullVisual,
  turret: Phaser.GameObjects.Image,
  aim: Vector,
  primaryWeapon: WeaponKind,
  visible: boolean,
): void {
  renderPlayerHull(player, hull, visible);
  turret.setVisible(visible);
  turret.setTexture(getPlayerTurretTextureKey(primaryWeapon));
  turret.setPosition(player.x, player.y);
  turret.setRotation(Math.atan2(aim.y, aim.x));
  turret.setScale(player.scale ?? 1);
}

export function createPlayerHullVisual(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth: number,
): PlayerHullVisual {
  return {
    current: scene.add
      .image(x, y, PLAYER_TEXTURE_KEY, PLAYER_HULL_DEFAULT_FRAME_KEY)
      .setDepth(depth),
    next: scene.add
      .image(x, y, PLAYER_TEXTURE_KEY, PLAYER_HULL_DEFAULT_FRAME_KEY)
      .setAlpha(0)
      .setDepth(depth),
  };
}

export function renderPlayerHull(
  player: PlayerHullRenderTarget,
  hull: PlayerHullVisual,
  visible: boolean,
): void {
  player.setVisible(false);
  hull.current.setVisible(visible);
  hull.next.setVisible(false);
  if (!visible) return;

  const blend = getPlayerHullTextureBlend(player.rotation);
  applyHullFrame(hull.current, player, blend.current, 1);
  applyHullFrame(hull.next, player, blend.next, blend.nextAlpha);
  hull.next.setVisible(blend.nextAlpha > 0.001);
}

function applyHullFrame(
  image: Phaser.GameObjects.Image,
  player: PlayerRenderTarget,
  frame: { frameAngle: number; frameKey: string; textureKey: string },
  alpha: number,
): void {
  if (image.texture.key !== frame.textureKey || image.frame.name !== frame.frameKey)
    image.setTexture(frame.textureKey, frame.frameKey);
  image.setPosition(player.x, player.y);
  image.setScale(player.scale ?? 1);
  image.setRotation(Phaser.Math.Angle.Wrap(player.rotation - frame.frameAngle));
  image.setAlpha(alpha);
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
