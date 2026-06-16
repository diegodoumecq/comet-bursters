import Phaser from 'phaser';

import type { WorldSize } from '../../core/types';

const NEBULA_DEPTH = -120;
const TEXTURE_KEY_PREFIX = 'sandbox-nebula-background';
const TILE_TEXTURE_SIZE = 1536;
const TAU = Math.PI * 2;
const SEED = 37.171;
const BASE_WRAP_CYCLES = 32;

type NebulaLayerConfig = {
  alpha: number;
  cyclesX: number;
  cyclesY: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  tint: number;
};

const LAYERS: NebulaLayerConfig[] = [
  {
    alpha: 0.55,
    cyclesX: BASE_WRAP_CYCLES,
    cyclesY: BASE_WRAP_CYCLES,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    tint: 0x9ab8ff,
  },
  {
    alpha: 0.32,
    cyclesX: BASE_WRAP_CYCLES / 2,
    cyclesY: BASE_WRAP_CYCLES / 2,
    offsetX: 431,
    offsetY: 173,
    scale: 2,
    tint: 0x8ff2ff,
  },
  {
    alpha: 0.2,
    cyclesX: BASE_WRAP_CYCLES / 4,
    cyclesY: BASE_WRAP_CYCLES / 4,
    offsetX: 947,
    offsetY: 661,
    scale: 4,
    tint: 0xd1a6ff,
  },
];

export class SandboxNebulaBackground {
  private readonly layers: Phaser.GameObjects.TileSprite[];
  private readonly textureKey = `${TEXTURE_KEY_PREFIX}-${Phaser.Math.RND.uuid()}`;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.createNebulaTexture();
    this.layers = LAYERS.map((layer, index) =>
      scene.add
        .tileSprite(0, 0, scene.scale.width, scene.scale.height, this.textureKey)
        .setName(`sandbox-nebula-background-layer-${index}`)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(NEBULA_DEPTH + index)
        .setAlpha(layer.alpha)
        .setTint(layer.tint)
        .setTileScale(layer.scale, layer.scale)
        .setVisible(false),
    );
  }

  render(camera: Phaser.Cameras.Scene2D.Camera, world: WorldSize, visible: boolean): void {
    if (!visible) {
      this.setVisible(false);
      return;
    }

    this.setVisible(true);
    const cameraX = positiveModulo(camera.worldView.x, world.width);
    const cameraY = positiveModulo(camera.worldView.y, world.height);
    for (let index = 0; index < this.layers.length; index += 1) {
      const layer = this.layers[index];
      const config = LAYERS[index];
      layer.setSize(this.scene.scale.width, this.scene.scale.height);
      layer.tilePositionX = getTilePosition(cameraX, world.width, config.cyclesX, config.offsetX);
      layer.tilePositionY = getTilePosition(cameraY, world.height, config.cyclesY, config.offsetY);
    }
  }

  destroy(): void {
    for (const layer of this.layers) layer.destroy();
    if (this.scene.textures.exists(this.textureKey)) this.scene.textures.remove(this.textureKey);
  }

  private createNebulaTexture(): void {
    if (this.scene.textures.exists(this.textureKey)) return;

    const canvas = document.createElement('canvas');
    canvas.width = TILE_TEXTURE_SIZE;
    canvas.height = TILE_TEXTURE_SIZE;
    const context = canvas.getContext('2d');
    if (context) {
      const imageData = context.createImageData(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);
      paintNebulaTile(imageData);
      context.putImageData(imageData, 0, 0);
    }
    this.scene.textures.addCanvas(this.textureKey, canvas);
  }

  private setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    for (const layer of this.layers) layer.setVisible(visible);
  }
}

function paintNebulaTile(imageData: ImageData): void {
  const pixels = imageData.data;
  for (let y = 0; y < imageData.height; y += 1) {
    const v = y / imageData.height;
    for (let x = 0; x < imageData.width; x += 1) {
      const u = x / imageData.width;
      const color = sampleNebula(u, v);
      const offset = (y * imageData.width + x) * 4;
      pixels[offset] = color.r;
      pixels[offset + 1] = color.g;
      pixels[offset + 2] = color.b;
      pixels[offset + 3] = color.a;
    }
  }
}

function sampleNebula(u: number, v: number): { a: number; b: number; g: number; r: number } {
  const warpX = fbmPeriodic(u * 4 + 1.7, v * 4 + 7.2, 4, 4, 4) - 0.5;
  const warpY = fbmPeriodic(u * 4 + 8.9, v * 4 + 2.4, 4, 4, 4) - 0.5;
  const ribbonA = Math.sin((u * 3 + v * 2 + warpX * 0.85 + SEED * 0.03) * TAU) * 0.5 + 0.5;
  const ribbonB = Math.cos((u * 2 - v * 4 + warpY * 0.75 + SEED * 0.05) * TAU) * 0.5 + 0.5;
  const curvedU = u + warpX * 0.11 + Math.sin((u + v * 2) * TAU) * 0.012;
  const curvedV = v + warpY * 0.11 + Math.cos((u * 2 - v) * TAU) * 0.012;
  const broad = fbmPeriodic(curvedU * 5, curvedV * 5, 5, 5, 5);
  const cloud = fbmPeriodic(curvedU * 10 + 3.3, curvedV * 10 + 5.7, 10, 10, 4);
  const detail = fbmPeriodic(curvedU * 28 + warpY * 2.6, curvedV * 28 - warpX * 2.6, 28, 28, 3);
  const colorNoise = fbmPeriodic(curvedU * 8 + 9.1, curvedV * 8 + 4.2, 8, 8, 3);
  const ridge = 1 - Math.abs(detail * 2 - 1);
  const lane = smoothstep(0.58, 0.91, (1 - broad) * 0.52 + ribbonB * 0.22 + detail * 0.2);
  const mass = smoothstep(0.34, 0.86, broad * 0.54 + cloud * 0.34 + ridge * 0.12);
  const veil = smoothstep(0.28, 0.78, cloud * 0.46 + ribbonA * 0.28 + ridge * 0.16);
  const thread = smoothstep(0.75, 0.99, ridge * 0.62 + ribbonA * 0.18 + cloud * 0.12);
  const density = clamp(mass * 0.58 + veil * 0.22 + thread * 0.12 - lane * 0.32, 0, 1);
  const cold = mixColor({ r: 34, g: 70, b: 148 }, { r: 58, g: 48, b: 130 }, colorNoise);
  const warm = mixColor({ r: 92, g: 54, b: 136 }, { r: 28, g: 128, b: 146 }, cloud);
  const gas = mixColor(cold, warm, smoothstep(0.28, 0.88, veil));
  const pearl = { r: 158, g: 168, b: 190 };
  const highlight = mixColor(gas, pearl, thread * 0.18);
  const shade = 1 - lane * 0.42;
  const glow = density * 0.86 + thread * 0.12;

  return {
    a: clampByte(8 + density * 90 + veil * 30 + thread * 18),
    b: clampByte(highlight.b * glow * shade),
    g: clampByte(highlight.g * glow * shade),
    r: clampByte(highlight.r * glow * shade),
  };
}

function fbmPeriodic(
  x: number,
  y: number,
  periodX: number,
  periodY: number,
  octaves: number,
): number {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total +=
      noisePeriodic(x * frequency, y * frequency, periodX * frequency, periodY * frequency) *
      amplitude;
    normalization += amplitude;
    amplitude *= 0.52;
    frequency *= 2;
  }
  return normalization > 0 ? total / normalization : 0;
}

function noisePeriodic(x: number, y: number, periodX: number, periodY: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const a = hashGrid(x0, y0, periodX, periodY);
  const b = hashGrid(x1, y0, periodX, periodY);
  const c = hashGrid(x0, y1, periodX, periodY);
  const d = hashGrid(x1, y1, periodX, periodY);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function hashGrid(x: number, y: number, periodX: number, periodY: number): number {
  const wrappedX = positiveModuloInteger(x, periodX);
  const wrappedY = positiveModuloInteger(y, periodY);
  return (
    Math.abs(Math.sin((wrappedX + 1) * 127.1 + (wrappedY + 1) * 311.7 + SEED) * 43758.5453) % 1
  );
}

function getTilePosition(
  camera: number,
  worldSize: number,
  cycles: number,
  offset: number,
): number {
  if (worldSize <= 0) return offset;
  return positiveModulo(
    (camera / worldSize) * TILE_TEXTURE_SIZE * cycles + offset,
    TILE_TEXTURE_SIZE,
  );
}

function mixColor(
  from: { b: number; g: number; r: number },
  to: { b: number; g: number; r: number },
  amount: number,
): { b: number; g: number; r: number } {
  return {
    b: lerp(from.b, to.b, amount),
    g: lerp(from.g, to.g, amount),
    r: lerp(from.r, to.r, amount),
  };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampByte(value: number): number {
  return clamp(Math.round(value), 0, 255);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function positiveModuloInteger(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
