import Phaser from 'phaser';

import type { Vector, WorldSize } from '../core/types';

type Star = {
  alpha: number;
  glint: boolean;
  radius: number;
  tint: number;
  x: number;
  y: number;
};

type StarLayer = {
  factor: number;
  sprite: Phaser.GameObjects.TileSprite;
  textureKey: string;
  twinkle: number;
};

const LAYERS = [
  { count: 190, depth: -34, factor: 0.18, maxRadius: 0.9, minRadius: 0.45, twinkle: 0.015 },
  { count: 95, depth: -33, factor: 0.34, maxRadius: 1.3, minRadius: 0.65, twinkle: 0.025 },
  { count: 34, depth: -32, factor: 0.58, maxRadius: 1.9, minRadius: 0.9, twinkle: 0.035 },
] as const;
const TINTS = [0xd8e8ff, 0xffffff, 0xfff1d1, 0xc8ddff] as const;

export class Starfield {
  private readonly texturePrefix = `phaser-starfield-${Phaser.Math.RND.uuid()}`;
  private layers: StarLayer[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private screen: WorldSize,
    private readonly depthShift = 0,
    private readonly seedOffset = 0,
  ) {
    this.createLayers();
  }

  render(now: number, drift: Vector, deltaMs: number): void {
    for (const layer of this.layers) {
      const currentDrift = {
        x: drift.x + Math.sin(now * 0.00011) * 0.003,
        y: drift.y + Math.cos(now * 0.00009) * 0.002,
      };
      layer.sprite.tilePositionX = wrap(
        layer.sprite.tilePositionX - currentDrift.x * deltaMs * layer.factor,
        this.screen.width,
      );
      layer.sprite.tilePositionY = wrap(
        layer.sprite.tilePositionY - currentDrift.y * deltaMs * layer.factor,
        this.screen.height,
      );
      layer.sprite.alpha = Phaser.Math.Clamp(1 + Math.sin(now * 0.00032) * layer.twinkle, 0, 1);
    }
  }

  setVisible(visible: boolean): void {
    for (const layer of this.layers) layer.sprite.setVisible(visible);
  }

  resize(screen: WorldSize): void {
    this.screen = screen;
    this.destroyLayers();
    this.createLayers();
  }

  destroy(): void {
    this.destroyLayers();
  }

  private createLayers(): void {
    this.layers = LAYERS.map((config, layerIndex) => ({
      factor: config.factor,
      sprite: this.scene.add
        .tileSprite(
          0,
          0,
          this.screen.width,
          this.screen.height,
          this.createLayerTexture(config, layerIndex),
        )
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(config.depth + this.depthShift),
      textureKey: this.getTextureKey(layerIndex),
      twinkle: config.twinkle,
    }));
  }

  private createLayerTexture(config: (typeof LAYERS)[number], layerIndex: number): string {
    const textureKey = this.getTextureKey(layerIndex);
    if (this.scene.textures.exists(textureKey)) return textureKey;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(this.screen.width));
    canvas.height = Math.max(1, Math.ceil(this.screen.height));
    const context = canvas.getContext('2d');
    if (!context) {
      this.scene.textures.addCanvas(textureKey, canvas);
      return textureKey;
    }

    for (const star of createStars(this.screen, config, layerIndex, this.seedOffset)) {
      context.globalAlpha = star.alpha;
      context.fillStyle = toCanvasColor(star.tint);
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
      if (star.glint) {
        context.globalAlpha = star.alpha * 0.28;
        context.strokeStyle = toCanvasColor(star.tint);
        context.lineWidth = 1;
        const length = star.radius * 4.8;
        context.beginPath();
        context.moveTo(star.x - length, star.y);
        context.lineTo(star.x + length, star.y);
        context.moveTo(star.x, star.y - length);
        context.lineTo(star.x, star.y + length);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
    this.scene.textures.addCanvas(textureKey, canvas);
    return textureKey;
  }

  private destroyLayers(): void {
    for (const layer of this.layers) {
      layer.sprite.destroy();
      this.scene.textures.remove(layer.textureKey);
    }
    this.layers = [];
  }

  private getTextureKey(layerIndex: number): string {
    return `${this.texturePrefix}-${layerIndex}`;
  }
}

function createStars(
  screen: WorldSize,
  config: (typeof LAYERS)[number],
  layerIndex: number,
  seedOffset: number,
): Star[] {
  return Array.from({ length: config.count }, (_, index) => {
    const seed = seedOffset + layerIndex * 1000 + index;
    const brightness = 0.55 + seededUnit(seed, 29) * 0.45;
    return {
      alpha: (0.28 + seededUnit(seed, 41) * 0.48) * brightness,
      glint: layerIndex > 0 && seededUnit(seed, 53) > 0.88,
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

function toCanvasColor(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`;
}

function seededUnit(index: number, seed: number): number {
  return Math.abs(Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
}
