import Phaser from 'phaser';

import type { AsteroidTier } from '../model';
import { ASTEROIDS } from './asteroids';

export const ASTEROID_TEXTURES: Record<AsteroidTier, readonly string[]> = {
  mega: ['phaser-asteroid-mega-0', 'phaser-asteroid-mega-1'],
  big: ['phaser-asteroid-big-0', 'phaser-asteroid-big-1'],
  medium: ['phaser-asteroid-medium-0', 'phaser-asteroid-medium-1'],
  small: ['phaser-asteroid-small-0', 'phaser-asteroid-small-1'],
};

const COLORS: Record<AsteroidTier, readonly string[]> = {
  mega: ['#ff6b6b', '#ff69b4'],
  big: ['#ffd93d', '#ff8800'],
  medium: ['#6bcb77', '#40e0d0'],
  small: ['#4d96ff', '#9b59b6'],
};

export function createAsteroidTextures(scene: Phaser.Scene): void {
  for (const tier of Object.keys(ASTEROIDS) as AsteroidTier[]) {
    ASTEROID_TEXTURES[tier].forEach((key, index) => {
      if (scene.textures.exists(key)) return;
      const canvas = drawAsteroidTexture(tier, COLORS[tier][index]);
      scene.textures.addCanvas(key, canvas);
    });
  }
}

function drawAsteroidTexture(tier: AsteroidTier, color: string): HTMLCanvasElement {
  const radius = ASTEROIDS[tier].radius;
  const diameter = radius * 2;
  const canvas = document.createElement('canvas');
  canvas.width = diameter;
  canvas.height = diameter;
  const ctx = canvas.getContext('2d')!;
  const rand = createSeededRandom(hashString(`${tier}:${color}`));
  const pointCount = tier === 'mega' ? 36 : tier === 'big' ? 30 : tier === 'medium' ? 24 : 16;

  ctx.save();
  ctx.translate(radius, radius);
  ctx.rotate(rand() * Math.PI * 2);
  traceRockShape(ctx, rand, radius * 0.94, pointCount);
  const shell = ctx.createRadialGradient(-radius * 0.28, -radius * 0.34, radius * 0.16, 0, 0, radius);
  shell.addColorStop(0, mixHexColor(color, '#ffffff', 0.28));
  shell.addColorStop(0.45, color);
  shell.addColorStop(1, mixHexColor(color, '#101622', 0.45));
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.strokeStyle = mixHexColor(color, '#101622', 0.62);
  ctx.lineWidth = Math.max(2, radius * 0.06);
  ctx.stroke();

  ctx.save();
  traceRockShape(ctx, rand, radius * 0.92, pointCount);
  ctx.clip();
  drawBands(ctx, rand, radius, tier);
  drawCraters(ctx, rand, radius, tier);
  drawHighlight(ctx, radius);
  ctx.restore();
  ctx.restore();
  return canvas;
}

function drawBands(ctx: CanvasRenderingContext2D, rand: () => number, radius: number, tier: AsteroidTier): void {
  const count = tier === 'mega' ? 10 : tier === 'big' ? 8 : tier === 'medium' ? 6 : 5;
  for (let index = 0; index < count; index += 1) {
    const y = (-0.64 + (index / Math.max(1, count - 1)) * 1.28) * radius;
    const gradient = ctx.createLinearGradient(-radius * 0.86, y, radius * 0.86, y);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.18, index % 2 === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(10,14,26,0.08)');
    gradient.addColorStop(0.58, index % 2 === 0 ? 'rgba(10,14,26,0.1)' : 'rgba(255,255,255,0.05)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(0.9, radius * 0.022);
    ctx.beginPath();
    for (let x = -radius * 0.84; x <= radius * 0.84; x += radius * 0.12) {
      const normalizedX = (x + radius) / (radius * 2);
      const wave =
        Math.sin(normalizedX * Math.PI * 2 + index * 0.54 + rand() * Math.PI * 0.5) * radius * 0.042 +
        Math.cos(normalizedX * Math.PI * 3 + index * 0.12) * radius * 0.01;
      if (x === -radius * 0.84) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
}

function drawCraters(ctx: CanvasRenderingContext2D, rand: () => number, radius: number, tier: AsteroidTier): void {
  const placements: Array<{ radius: number; x: number; y: number }> = [];
  for (let index = 0; index < 4; index += 1) {
    const craterRadius = radius * (tier === 'mega' ? 0.14 + rand() * 0.1 : 0.1 + rand() * 0.08);
    let placement: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const x = (rand() - 0.5) * radius * 0.88;
      const y = (rand() - 0.5) * radius * 0.88;
      const inside = Math.hypot(x, y) + craterRadius <= radius * 0.88;
      const overlaps = placements.some((other) => Math.hypot(x - other.x, y - other.y) < craterRadius + other.radius + radius * 0.04);
      if (inside && !overlaps) {
        placement = { x, y };
        break;
      }
    }
    if (!placement) return;
    placements.push({ ...placement, radius: craterRadius });
    const squash = 0.74 + rand() * 0.18;
    ctx.save();
    ctx.translate(placement.x, placement.y);
    ctx.rotate(rand() * Math.PI);
    const basin = ctx.createRadialGradient(-craterRadius * 0.12, -craterRadius * 0.14, craterRadius * 0.08, 0, 0, craterRadius * 1.04);
    basin.addColorStop(0, 'rgba(255,255,255,0.05)');
    basin.addColorStop(0.22, 'rgba(255,255,255,0.025)');
    basin.addColorStop(0.72, 'rgba(12,16,28,0.16)');
    basin.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = basin;
    ctx.beginPath();
    ctx.ellipse(0, 0, craterRadius, craterRadius * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHighlight(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.moveTo(-radius * 0.08, -radius * 0.58);
  ctx.lineTo(radius * 0.44, -radius * 0.26);
  ctx.lineTo(radius * 0.06, -radius * 0.14);
  ctx.lineTo(-radius * 0.24, -radius * 0.34);
  ctx.closePath();
  ctx.fill();
}

function traceRockShape(ctx: CanvasRenderingContext2D, rand: () => number, radius: number, pointCount: number): void {
  const rawRadii = Array.from({ length: pointCount }, () => radius * (0.82 + rand() * 0.16));
  const smoothedRadii = rawRadii.map((value, index) => {
    const previous = rawRadii[(index - 1 + pointCount) % pointCount];
    const next = rawRadii[(index + 1) % pointCount];
    return previous * 0.22 + value * 0.56 + next * 0.22;
  });
  ctx.beginPath();
  for (let index = 0; index < pointCount; index += 1) {
    const angle = (index / pointCount) * Math.PI * 2;
    const distance = smoothedRadii[index];
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  return hash;
}

function createSeededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let next = Math.imul(value ^ value >>> 15, 1 | value);
    next ^= next + Math.imul(next ^ next >>> 7, 61 | next);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

function mixHexColor(left: string, right: string, amount: number): string {
  const from = parseHex(left);
  const to = parseHex(right);
  const mix = (key: keyof typeof from) => Math.round(from[key] + (to[key] - from[key]) * amount);
  return `rgb(${mix('r')}, ${mix('g')}, ${mix('b')})`;
}

function parseHex(value: string): { b: number; g: number; r: number } {
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}
