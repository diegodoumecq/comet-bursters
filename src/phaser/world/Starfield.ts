import Phaser from 'phaser';

import type { Vector, WorldSize } from '../core/types';

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
  factor: number;
  graphics: Phaser.GameObjects.Graphics;
  stars: Star[];
  twinkle: number;
};

const LAYERS = [
  { count: 190, depth: -34, factor: 0.18, maxRadius: 0.9, minRadius: 0.45, twinkle: 0.015 },
  { count: 95, depth: -33, factor: 0.34, maxRadius: 1.3, minRadius: 0.65, twinkle: 0.025 },
  { count: 34, depth: -32, factor: 0.58, maxRadius: 1.9, minRadius: 0.9, twinkle: 0.035 },
] as const;
const TINTS = [0xd8e8ff, 0xffffff, 0xfff1d1, 0xc8ddff] as const;

export class Starfield {
  private layers: StarLayer[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private screen: WorldSize,
    private readonly depthShift = 0,
  ) {
    this.createLayers();
  }

  render(now: number, drift: Vector, deltaMs: number): void {
    for (const layer of this.layers) {
      this.updateLayer(layer, drift, deltaMs, now);
      this.drawLayer(layer, now);
    }
  }

  setVisible(visible: boolean): void {
    for (const layer of this.layers) layer.graphics.setVisible(visible);
  }

  resize(screen: WorldSize): void {
    this.screen = screen;
    for (const layer of this.layers) layer.graphics.destroy();
    this.createLayers();
  }

  destroy(): void {
    for (const layer of this.layers) layer.graphics.destroy();
    this.layers = [];
  }

  private createLayers(): void {
    this.layers = LAYERS.map((config, layerIndex) => ({
      factor: config.factor,
      graphics: this.scene.add
        .graphics()
        .setScrollFactor(0)
        .setDepth(config.depth + this.depthShift),
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
      const pulse = 1 + Math.sin(now * 0.00032 + star.phase) * layer.twinkle;
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

function seededUnit(index: number, seed: number): number {
  return Math.abs(Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
}
