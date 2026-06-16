import type Phaser from 'phaser';

import {
  createGeneratedCanvasTexture,
  ensureGeneratedCanvasTexture,
  type GeneratedAssetCacheEntry,
  type GeneratedCanvasTextureRecipe,
} from '../core/generatedAssetCache';
import type { GeneratedTextureGroup } from '../core/generatedTextureRegistry';
import type { WeaponKind } from '../weapons/types';
import { TURRET_SPRITE_DRAWERS, type TurretSpriteMetrics } from './turret';

export const PLAYER_TEXTURE_KEY = 'phaser-ship';
export const PLAYER_TURRET_TEXTURE_KEY = 'phaser-player-turret';
export const PLAYER_VISUAL_SIZE = 60;
export const PLAYER_TURRET_TEXTURE_SIZE = PLAYER_VISUAL_SIZE * 2;
export const PLAYER_TURRET_MUZZLE_OFFSET = PLAYER_VISUAL_SIZE * 0.5 * 0.68;
export const PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS = 0;
export const PLAYER_TURRET_TEXTURE_KEYS: Record<WeaponKind, string> = {
  blackHole: 'phaser-player-turret-black-hole',
  fuelGun: 'phaser-player-turret-fuel-gun',
  inspectionProbe: 'phaser-player-turret-inspection-probe',
  pusher: 'phaser-player-turret-pusher',
  shotgun: 'phaser-player-turret-shotgun',
  small: PLAYER_TURRET_TEXTURE_KEY,
  tractor: 'phaser-player-turret-tractor',
};

export type PlayerTurretSpriteSpec = {
  /** Forward +X visual tip shared by every turret sprite. */
  length: number;
  orientationRadians: number;
  textureKey: string;
  textureSize: number;
};

export const PLAYER_TURRET_SPRITE_SPECS: Record<WeaponKind, PlayerTurretSpriteSpec> = {
  blackHole: createTurretSpriteSpec('blackHole'),
  fuelGun: createTurretSpriteSpec('fuelGun'),
  inspectionProbe: createTurretSpriteSpec('inspectionProbe'),
  pusher: createTurretSpriteSpec('pusher'),
  shotgun: createTurretSpriteSpec('shotgun'),
  small: createTurretSpriteSpec('small'),
  tractor: createTurretSpriteSpec('tractor'),
};

export function createPlayerTexture(scene: Phaser.Scene): void {
  for (const recipe of createPlayerTextureRecipes()) {
    createGeneratedCanvasTexture(scene, recipe);
  }
}

export async function ensurePlayerTextures(scene: Phaser.Scene): Promise<void> {
  await Promise.all(
    createPlayerTextureRecipes().map((recipe) => ensureGeneratedCanvasTexture(scene, recipe)),
  );
}

export const PLAYER_GENERATED_TEXTURE_GROUP = {
  cacheEntries: getPlayerTextureCacheEntries,
  ensure: ensurePlayerTextures,
  key: 'player',
  label: 'Player sprites',
  textureKeys: getPlayerTextureKeys,
} satisfies GeneratedTextureGroup;

export function getPlayerTurretTextureKey(weapon: WeaponKind): string {
  return PLAYER_TURRET_TEXTURE_KEYS[weapon];
}

function createTurretSpriteSpec(weapon: WeaponKind): PlayerTurretSpriteSpec {
  return {
    length: PLAYER_TURRET_MUZZLE_OFFSET,
    orientationRadians: PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS,
    textureKey: PLAYER_TURRET_TEXTURE_KEYS[weapon],
    textureSize: PLAYER_TURRET_TEXTURE_SIZE,
  };
}

function createPlayerTextureRecipes(): GeneratedCanvasTextureRecipe[] {
  return [
    {
      draw: (ctx) => {
        ctx.translate(PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE);
        drawHull(ctx, PLAYER_VISUAL_SIZE * 0.5);
      },
      height: PLAYER_VISUAL_SIZE * 2,
      key: PLAYER_TEXTURE_KEY,
      version: 'player-hull-v1',
      width: PLAYER_VISUAL_SIZE * 2,
    },
    ...(Object.keys(PLAYER_TURRET_TEXTURE_KEYS) as WeaponKind[]).map((weapon) =>
      createPlayerTurretTextureRecipe(weapon),
    ),
  ];
}

function getPlayerTextureCacheEntries(): GeneratedAssetCacheEntry[] {
  return createPlayerTextureRecipes().map((recipe) => ({
    textureKey: recipe.key,
    version: recipe.version,
  }));
}

function getPlayerTextureKeys(): string[] {
  return createPlayerTextureRecipes().map((recipe) => recipe.key);
}

function createPlayerTurretTextureRecipe(weapon: WeaponKind): GeneratedCanvasTextureRecipe {
  return {
    draw: (ctx) => {
      ctx.translate(PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE);
      drawTurret(ctx, weapon);
    },
    height: PLAYER_TURRET_TEXTURE_SIZE,
    key: PLAYER_TURRET_TEXTURE_KEYS[weapon],
    version: `player-turret-${weapon}-v1`,
    width: PLAYER_TURRET_TEXTURE_SIZE,
  };
}

export function drawFuelContour(
  base: Phaser.GameObjects.Graphics,
  fill: Phaser.GameObjects.Graphics,
  mask: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rotation: number,
  fuelRatio: number,
  now: number,
  scale = 1,
): void {
  const size = PLAYER_VISUAL_SIZE * 0.5 * scale;
  base.clear();
  fill.clear();
  mask.clear();
  base.setPosition(x, y);
  fill.setPosition(x, y);
  mask.setPosition(x, y);
  base.setRotation(rotation);
  fill.setRotation(rotation);
  mask.setRotation(rotation);
  if (fuelRatio <= 0.1) {
    const pulse = 0.45 + Math.sin(now / 120) * 0.35;
    base.lineStyle(2, 0xff232d, 0.45 + pulse * 0.3);
    strokeHull(base, size);
    return;
  }
  base.lineStyle(2, 0x2d3e55, 0.58);
  strokeHull(base, size);
  fill.lineStyle(2, 0x55f5ff, 0.82);
  strokeHull(fill, size);
  mask.fillStyle(0xffffff, 1);
  mask.fillRect(-size * 0.92, -size * 0.68, size * 1.92 * fuelRatio, size * 1.36);
}

function drawHull(ctx: CanvasRenderingContext2D, size: number): void {
  const hull = ctx.createLinearGradient(-size * 0.85, 0, size, 0);
  hull.addColorStop(0, '#1a202c');
  hull.addColorStop(0.22, '#debbad');
  hull.addColorStop(0.68, '#f2f6ff');
  hull.addColorStop(1, '#ffffff');
  ctx.fillStyle = hull;
  ctx.strokeStyle = '#121826';
  ctx.lineWidth = 2;
  traceHull(ctx, size);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(size * 0.72, -size * 0.02);
  ctx.lineTo(size * 0.08, -size * 0.09);
  ctx.lineTo(-size * 0.22, -size * 0.06);
  ctx.lineTo(size * 0.18, -size * 0.01);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#202a3a';
  ctx.beginPath();
  ctx.moveTo(size * 0.2, -size * 0.08);
  ctx.lineTo(-size * 0.18, -size * 0.22);
  ctx.lineTo(-size * 0.48, -size * 0.09);
  ctx.lineTo(-size * 0.12, -size * 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.08);
  ctx.lineTo(-size * 0.18, size * 0.22);
  ctx.lineTo(-size * 0.48, size * 0.09);
  ctx.lineTo(-size * 0.12, size * 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.52, 0);
  ctx.lineTo(size * 0.78, 0);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-size * 0.62, -size * 0.16);
  ctx.lineTo(-size * 0.42, -size * 0.12);
  ctx.lineTo(-size * 0.42, size * 0.12);
  ctx.lineTo(-size * 0.62, size * 0.16);
  ctx.closePath();
  ctx.fill();
  const canopy = ctx.createLinearGradient(0, -size * 0.28, 0, size * 0.28);
  canopy.addColorStop(0, '#dff7ff');
  canopy.addColorStop(0.45, '#7dd3fc');
  canopy.addColorStop(1, '#082f49');
  ctx.fillStyle = canopy;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(size * 0.34, 0);
  ctx.quadraticCurveTo(size * 0.04, -size * 0.26, -size * 0.18, 0);
  ctx.quadraticCurveTo(size * 0.04, size * 0.26, size * 0.34, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(size * 0.72, 0, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawTurret(ctx: CanvasRenderingContext2D, weapon: WeaponKind): void {
  const size = PLAYER_VISUAL_SIZE * 0.5;
  const metrics: TurretSpriteMetrics = {
    baseRadius: size * 0.24,
    length: PLAYER_TURRET_MUZZLE_OFFSET,
    mountX: size * 0.08,
    rearX: -size * 0.14,
  };
  TURRET_SPRITE_DRAWERS[weapon](ctx, metrics);
}

function traceHull(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size * 0.46, -size * 0.14);
  ctx.lineTo(size * 0.18, -size * 0.2);
  ctx.lineTo(-size * 0.08, -size * 0.54);
  ctx.lineTo(-size * 0.36, -size * 0.46);
  ctx.lineTo(-size * 0.84, -size * 0.22);
  ctx.lineTo(-size * 0.58, -size * 0.08);
  ctx.lineTo(-size * 0.72, 0);
  ctx.lineTo(-size * 0.58, size * 0.08);
  ctx.lineTo(-size * 0.84, size * 0.22);
  ctx.lineTo(-size * 0.36, size * 0.46);
  ctx.lineTo(-size * 0.08, size * 0.54);
  ctx.lineTo(size * 0.18, size * 0.2);
  ctx.lineTo(size * 0.46, size * 0.14);
  ctx.closePath();
}

export function tracePlayerHull(graphics: Phaser.GameObjects.Graphics, size: number): void {
  graphics.beginPath();
  graphics.moveTo(size, 0);
  graphics.lineTo(size * 0.46, -size * 0.14);
  graphics.lineTo(size * 0.18, -size * 0.2);
  graphics.lineTo(-size * 0.08, -size * 0.54);
  graphics.lineTo(-size * 0.36, -size * 0.46);
  graphics.lineTo(-size * 0.84, -size * 0.22);
  graphics.lineTo(-size * 0.58, -size * 0.08);
  graphics.lineTo(-size * 0.72, 0);
  graphics.lineTo(-size * 0.58, size * 0.08);
  graphics.lineTo(-size * 0.84, size * 0.22);
  graphics.lineTo(-size * 0.36, size * 0.46);
  graphics.lineTo(-size * 0.08, size * 0.54);
  graphics.lineTo(size * 0.18, size * 0.2);
  graphics.lineTo(size * 0.46, size * 0.14);
  graphics.closePath();
}

export function fillPlayerHull(graphics: Phaser.GameObjects.Graphics, size: number): void {
  tracePlayerHull(graphics, size);
  graphics.fillPath();
}

export function strokePlayerHull(graphics: Phaser.GameObjects.Graphics, size: number): void {
  tracePlayerHull(graphics, size);
  graphics.strokePath();
}

function strokeHull(graphics: Phaser.GameObjects.Graphics, size: number): void {
  strokePlayerHull(graphics, size);
}
