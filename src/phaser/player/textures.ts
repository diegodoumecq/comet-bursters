import type Phaser from 'phaser';

import type { WeaponKind } from '../weapons/types';

export const PLAYER_TEXTURE_KEY = 'phaser-ship';
export const PLAYER_TURRET_TEXTURE_KEY = 'phaser-player-turret';
export const PLAYER_TURRET_TEXTURE_KEYS: Record<WeaponKind, string> = {
  blackHole: 'phaser-player-turret-black-hole',
  fuelGun: 'phaser-player-turret-fuel-gun',
  inspectionProbe: 'phaser-player-turret-inspection-probe',
  pusher: 'phaser-player-turret-pusher',
  shotgun: 'phaser-player-turret-shotgun',
  small: PLAYER_TURRET_TEXTURE_KEY,
  tractor: 'phaser-player-turret-tractor',
};
export const PLAYER_VISUAL_SIZE = 60;
export const PLAYER_TURRET_MUZZLE_OFFSET = PLAYER_VISUAL_SIZE * 0.5 * 0.68;

type TurretVisualSpec = {
  accent: string;
  barrel: [string, string, string];
  core: [string, string, string];
  muzzle: string;
};

const TURRET_VISUALS: Record<WeaponKind, TurretVisualSpec> = {
  blackHole: {
    accent: '#a78bfa',
    barrel: ['#312e81', '#a78bfa', '#111827'],
    core: ['#f5f3ff', '#7c3aed', '#111827'],
    muzzle: '#d8b4fe',
  },
  fuelGun: {
    accent: '#facc15',
    barrel: ['#713f12', '#fde68a', '#854d0e'],
    core: ['#fff7ed', '#f59e0b', '#1f2937'],
    muzzle: '#fef08a',
  },
  inspectionProbe: {
    accent: '#bfdbfe',
    barrel: ['#334155', '#dbeafe', '#475569'],
    core: ['#ffffff', '#93c5fd', '#1e293b'],
    muzzle: '#e0f2fe',
  },
  pusher: {
    accent: '#86efac',
    barrel: ['#14532d', '#bbf7d0', '#166534'],
    core: ['#ecfdf5', '#22c55e', '#0f172a'],
    muzzle: '#bbf7d0',
  },
  shotgun: {
    accent: '#fdba74',
    barrel: ['#7c2d12', '#fed7aa', '#9a3412'],
    core: ['#fff7ed', '#f97316', '#111827'],
    muzzle: '#ffedd5',
  },
  small: {
    accent: '#38bdf8',
    barrel: ['#94a3b8', '#e2e8f0', '#475569'],
    core: ['#e2e8f0', '#475569', '#0f172a'],
    muzzle: '#38bdf8',
  },
  tractor: {
    accent: '#67e8f9',
    barrel: ['#155e75', '#a5f3fc', '#164e63'],
    core: ['#ecfeff', '#06b6d4', '#0f172a'],
    muzzle: '#cffafe',
  },
};

export function createPlayerTexture(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PLAYER_TEXTURE_KEY)) {
    const canvas = document.createElement('canvas');
    canvas.width = PLAYER_VISUAL_SIZE * 2;
    canvas.height = PLAYER_VISUAL_SIZE * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE);
    drawHull(ctx, PLAYER_VISUAL_SIZE * 0.5);
    scene.textures.addCanvas(PLAYER_TEXTURE_KEY, canvas);
  }
  for (const weapon of Object.keys(PLAYER_TURRET_TEXTURE_KEYS) as WeaponKind[]) {
    const textureKey = PLAYER_TURRET_TEXTURE_KEYS[weapon];
    if (!scene.textures.exists(textureKey)) {
      const canvas = document.createElement('canvas');
      canvas.width = PLAYER_VISUAL_SIZE * 2;
      canvas.height = PLAYER_VISUAL_SIZE * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE);
      drawTurret(ctx, PLAYER_VISUAL_SIZE * 0.5, TURRET_VISUALS[weapon]);
      scene.textures.addCanvas(textureKey, canvas);
    }
  }
}

export function getPlayerTurretTextureKey(weapon: WeaponKind): string {
  return PLAYER_TURRET_TEXTURE_KEYS[weapon];
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

function drawTurret(ctx: CanvasRenderingContext2D, size: number, visual: TurretVisualSpec): void {
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.28);
  core.addColorStop(0, visual.core[0]);
  core.addColorStop(0.55, visual.core[1]);
  core.addColorStop(1, visual.core[2]);
  ctx.fillStyle = core;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.08, -size * 0.11);
  ctx.lineTo(size * 0.26, -size * 0.11);
  ctx.lineTo(size * 0.34, -size * 0.07);
  ctx.lineTo(size * 0.68, -size * 0.05);
  ctx.lineTo(size * 0.65, 0);
  ctx.lineTo(size * 0.68, size * 0.05);
  ctx.lineTo(size * 0.34, size * 0.07);
  ctx.lineTo(size * 0.26, size * 0.11);
  ctx.lineTo(size * 0.08, size * 0.11);
  ctx.closePath();
  const barrel = ctx.createLinearGradient(size * 0.08, 0, size * 0.7, 0);
  barrel.addColorStop(0, visual.barrel[0]);
  barrel.addColorStop(0.45, visual.barrel[1]);
  barrel.addColorStop(1, visual.barrel[2]);
  ctx.fillStyle = barrel;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = visual.muzzle;
  ctx.beginPath();
  ctx.arc(size * 0.18, 0, size * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = visual.accent;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(size * 0.32, -size * 0.12);
  ctx.lineTo(size * 0.68, -size * 0.07);
  ctx.moveTo(size * 0.32, size * 0.12);
  ctx.lineTo(size * 0.68, size * 0.07);
  ctx.stroke();
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
