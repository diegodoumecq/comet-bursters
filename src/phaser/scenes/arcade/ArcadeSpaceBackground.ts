import Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';

type Star = {
  alpha: number;
  glint: boolean;
  phase: number;
  radius: number;
  tint: number;
  x: number;
  y: number;
};

type StarLayer = {
  depth: number;
  factor: number;
  graphics: Phaser.GameObjects.Graphics;
  stars: Star[];
  twinkle: number;
};

const MAX_DELTA_MS = 50;
const BASE_DRIFT: Vector = { x: -0.018, y: 0.011 };
const VELOCITY_DRIFT_SCALE = 0.006;
const VELOCITY_SMOOTHING = 0.08;
const NEBULA_DEPTH = -36;
const NEBULA_FACTOR = 0.018;
const NEBULA_TEXTURE_SIZE = 768;
const NEBULA_TEXTURE_KEY = 'arcade-cloud-nebula-v2';
const LAYERS = [
  { count: 190, depth: -34, factor: 0.18, maxRadius: 0.9, minRadius: 0.45, twinkle: 0.015 },
  { count: 95, depth: -33, factor: 0.34, maxRadius: 1.3, minRadius: 0.65, twinkle: 0.025 },
  { count: 34, depth: -32, factor: 0.58, maxRadius: 1.9, minRadius: 0.9, twinkle: 0.035 },
] as const;
const TINTS = [0xd8e8ff, 0xffffff, 0xfff1d1, 0xc8ddff] as const;

export class ArcadeSpaceBackground {
  private nebula!: Phaser.GameObjects.TileSprite;
  private layers: StarLayer[] = [];
  private lastRenderAt = 0;
  private smoothedVelocity: Vector = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private screen: WorldSize,
  ) {
    this.createNebula();
    this.createLayers();
  }

  render(now: number, playerVelocity: Vector): void {
    const deltaMs =
      this.lastRenderAt === 0 ? 0 : Math.min(MAX_DELTA_MS, Math.max(0, now - this.lastRenderAt));
    this.lastRenderAt = now;
    this.smoothedVelocity.x = Phaser.Math.Linear(
      this.smoothedVelocity.x,
      playerVelocity.x,
      VELOCITY_SMOOTHING,
    );
    this.smoothedVelocity.y = Phaser.Math.Linear(
      this.smoothedVelocity.y,
      playerVelocity.y,
      VELOCITY_SMOOTHING,
    );

    const drift = {
      x: BASE_DRIFT.x - this.smoothedVelocity.x * VELOCITY_DRIFT_SCALE,
      y: BASE_DRIFT.y - this.smoothedVelocity.y * VELOCITY_DRIFT_SCALE,
    };

    this.nebula.tilePositionX += drift.x * deltaMs * NEBULA_FACTOR;
    this.nebula.tilePositionY += drift.y * deltaMs * NEBULA_FACTOR;
    for (const layer of this.layers) {
      this.updateLayer(layer, drift, deltaMs, now);
      this.drawLayer(layer, now);
    }
  }

  resize(screen: WorldSize): void {
    this.screen = screen;
    this.nebula.destroy();
    this.createNebula();
    for (const layer of this.layers) layer.graphics.destroy();
    this.createLayers();
  }

  private createNebula(): void {
    if (this.scene.textures.exists(NEBULA_TEXTURE_KEY))
      this.scene.textures.remove(NEBULA_TEXTURE_KEY);
    this.scene.textures.addCanvas(NEBULA_TEXTURE_KEY, createNebulaTexture());
    this.nebula = this.scene.add
      .tileSprite(0, 0, this.screen.width, this.screen.height, NEBULA_TEXTURE_KEY)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(NEBULA_DEPTH)
      .setAlpha(0.68);
  }

  private createLayers(): void {
    this.layers = LAYERS.map((config, layerIndex) => ({
      depth: config.depth,
      factor: config.factor,
      graphics: this.scene.add.graphics().setScrollFactor(0).setDepth(config.depth),
      stars: createStars(this.screen, config, layerIndex),
      twinkle: config.twinkle,
    }));
  }

  private updateLayer(layer: StarLayer, drift: Vector, deltaMs: number, now: number): void {
    const currentDrift = {
      x: drift.x + Math.sin(now * 0.00011) * 0.003,
      y: drift.y + Math.cos(now * 0.00009) * 0.002,
    };
    for (const star of layer.stars) {
      star.x = wrap(star.x + currentDrift.x * deltaMs * layer.factor, this.screen.width);
      star.y = wrap(star.y + currentDrift.y * deltaMs * layer.factor, this.screen.height);
    }
  }

  private drawLayer(layer: StarLayer, now: number): void {
    layer.graphics.clear();
    for (const star of layer.stars) {
      const pulse = 1 + Math.sin(now * 0.0012 + star.phase) * layer.twinkle;
      const alpha = Phaser.Math.Clamp(star.alpha * pulse, 0, 1);
      layer.graphics.fillStyle(star.tint, alpha);
      layer.graphics.fillCircle(star.x, star.y, star.radius);
      if (star.glint) {
        const lineAlpha = alpha * 0.28;
        const length = star.radius * 4.8;
        layer.graphics.lineStyle(1, star.tint, lineAlpha);
        layer.graphics.lineBetween(star.x - length, star.y, star.x + length, star.y);
        layer.graphics.lineBetween(star.x, star.y - length, star.x, star.y + length);
      }
    }
  }
}

function createStars(
  screen: WorldSize,
  config: (typeof LAYERS)[number],
  layerIndex: number,
): Star[] {
  return Array.from({ length: config.count }, (_, index) => {
    const seed = layerIndex * 1000 + index;
    const brightness = 0.55 + seededUnit(seed, 29) * 0.45;
    return {
      alpha: (0.28 + seededUnit(seed, 41) * 0.48) * brightness,
      glint: layerIndex > 0 && seededUnit(seed, 53) > 0.88,
      phase: seededUnit(seed, 67) * Math.PI * 2,
      radius: Phaser.Math.Linear(config.minRadius, config.maxRadius, seededUnit(seed, 79)),
      tint: TINTS[Math.floor(seededUnit(seed, 97) * TINTS.length)],
      x: seededUnit(seed, 11) * screen.width,
      y: seededUnit(seed, 17) * screen.height,
    };
  });
}

function wrap(value: number, max: number): number {
  if (max <= 0) return 0;
  if (value < 0) return value + max;
  if (value >= max) return value - max;
  return value;
}

function createNebulaTexture(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = NEBULA_TEXTURE_SIZE;
  canvas.height = NEBULA_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const image = ctx.createImageData(NEBULA_TEXTURE_SIZE, NEBULA_TEXTURE_SIZE);
  for (let y = 0; y < NEBULA_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < NEBULA_TEXTURE_SIZE; x += 1) {
      const value = fbm(x / NEBULA_TEXTURE_SIZE, y / NEBULA_TEXTURE_SIZE);
      const shaped = smoothStep(0.34, 0.78, value);
      const colorMix = smoothStep(0.38, 0.88, value);
      const index = (y * NEBULA_TEXTURE_SIZE + x) * 4;
      image.data[index] = Math.round(24 + colorMix * 34);
      image.data[index + 1] = Math.round(48 + colorMix * 58);
      image.data[index + 2] = Math.round(88 + colorMix * 104);
      image.data[index + 3] = Math.round(shaped * 118);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function fbm(x: number, y: number): number {
  let value = 0;
  let amplitude = 0.52;
  let frequency = 2;
  let total = 0;
  for (let octave = 0; octave < 5; octave += 1) {
    value += periodicValueNoise(x * frequency, y * frequency, frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

function periodicValueNoise(x: number, y: number, period: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const localX = x - cellX;
  const localY = y - cellY;
  const smoothX = localX * localX * (3 - 2 * localX);
  const smoothY = localY * localY * (3 - 2 * localY);
  const x0 = positiveModulo(cellX, period);
  const y0 = positiveModulo(cellY, period);
  const x1 = positiveModulo(cellX + 1, period);
  const y1 = positiveModulo(cellY + 1, period);
  const top = Phaser.Math.Linear(hash2(x0, y0), hash2(x1, y0), smoothX);
  const bottom = Phaser.Math.Linear(hash2(x0, y1), hash2(x1, y1), smoothX);
  return Phaser.Math.Linear(top, bottom, smoothY);
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

function hash2(x: number, y: number): number {
  return seededUnit(x * 374761 + y * 668265, 43);
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = Phaser.Math.Clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function seededUnit(index: number, seed: number): number {
  return Math.abs(Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
}
