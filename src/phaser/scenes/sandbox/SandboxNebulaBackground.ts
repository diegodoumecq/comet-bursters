import Phaser from 'phaser';

import type { WorldSize } from '../../core/types';

const NEBULA_DEPTH = -120;
const NEBULA_PARALLAX = 0.25;
const TARGET_CHUNK_SIZE = 1000;
const CHUNK_TEXTURE_SIZE = 320;
const MAX_CACHED_CHUNKS = 64;
const MAX_VISIBLE_CHUNK_COLUMNS = 8;
const MAX_VISIBLE_CHUNK_ROWS = 8;
const TEXTURE_PREFIX = 'sandbox-nebula-background';
const TAU = Math.PI * 2;

type NebulaLayout = {
  chunkHeight: number;
  chunkWidth: number;
  columns: number;
  height: number;
  rows: number;
  width: number;
};

type CachedTexture = {
  lastUsed: number;
  textureKey: string;
};

export class SandboxNebulaBackground {
  private readonly blankTextureKey = `${TEXTURE_PREFIX}-blank-${Phaser.Math.RND.uuid()}`;
  private readonly texturePrefix = `${TEXTURE_PREFIX}-${Phaser.Math.RND.uuid()}`;
  private readonly textureCache = new Map<string, CachedTexture>();
  private readonly images: Phaser.GameObjects.Image[] = [];
  private layout: NebulaLayout | null = null;
  private renderIndex = 0;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.createBlankTexture();
  }

  render(camera: Phaser.Cameras.Scene2D.Camera, world: WorldSize, visible: boolean): void {
    if (!visible) {
      this.hideAllImages();
      return;
    }

    this.visible = true;
    const zoom = Math.max(camera.zoom, 0.001);
    const viewWidth = camera.worldView.width || this.scene.scale.width / zoom;
    const viewHeight = camera.worldView.height || this.scene.scale.height / zoom;
    const layout = this.getLayout(world, { height: viewHeight, width: viewWidth });
    const parallaxX = camera.worldView.x * NEBULA_PARALLAX;
    const parallaxY = camera.worldView.y * NEBULA_PARALLAX;
    const scrollX = positiveModulo(parallaxX, layout.width);
    const scrollY = positiveModulo(parallaxY, layout.height);
    const startColumn = Math.floor(scrollX / layout.chunkWidth);
    const startRow = Math.floor(scrollY / layout.chunkHeight);
    const localX = scrollX - startColumn * layout.chunkWidth;
    const localY = scrollY - startRow * layout.chunkHeight;
    const columns = Math.ceil(viewWidth / layout.chunkWidth) + 2;
    const rows = Math.ceil(viewHeight / layout.chunkHeight) + 2;
    const visibleChunkCount = rows * columns;
    const activeTextureKeys =
      this.textureCache.size + visibleChunkCount > MAX_CACHED_CHUNKS ? new Set<string>() : null;
    let imageIndex = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const chunkColumn = positiveModuloInteger(startColumn + column, layout.columns);
        const chunkRow = positiveModuloInteger(startRow + row, layout.rows);
        const textureKey = this.getChunkTexture(layout, chunkColumn, chunkRow);
        if (activeTextureKeys) activeTextureKeys.add(textureKey);
        this.renderChunkImage({
          displayHeight: layout.chunkHeight,
          displayWidth: layout.chunkWidth,
          imageIndex,
          textureKey,
          x: parallaxX + column * layout.chunkWidth - localX,
          y: parallaxY + row * layout.chunkHeight - localY,
        });
        imageIndex += 1;
      }
    }

    this.hideUnusedImages(imageIndex);
    if (activeTextureKeys) this.pruneTextureCache(activeTextureKeys);
  }

  destroy(): void {
    for (const image of this.images) image.destroy();
    this.images.length = 0;
    for (const cached of this.textureCache.values()) this.removeTexture(cached.textureKey);
    this.textureCache.clear();
    this.removeTexture(this.blankTextureKey);
  }

  private createBlankTexture(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    this.scene.textures.addCanvas(this.blankTextureKey, canvas);
  }

  private getLayout(world: WorldSize, view: WorldSize): NebulaLayout {
    const width = Math.max(TARGET_CHUNK_SIZE, world.width * NEBULA_PARALLAX);
    const height = Math.max(TARGET_CHUNK_SIZE, world.height * NEBULA_PARALLAX);
    const minChunkWidth = Math.max(TARGET_CHUNK_SIZE, view.width / (MAX_VISIBLE_CHUNK_COLUMNS - 2));
    const minChunkHeight = Math.max(TARGET_CHUNK_SIZE, view.height / (MAX_VISIBLE_CHUNK_ROWS - 2));
    const columns = Math.max(1, Math.floor(width / minChunkWidth));
    const rows = Math.max(1, Math.floor(height / minChunkHeight));
    const chunkWidth = width / columns;
    const chunkHeight = height / rows;
    const nextLayout = { chunkHeight, chunkWidth, columns, height, rows, width };
    if (!this.layout) this.layout = nextLayout;
    if (
      this.layout.width !== width ||
      this.layout.height !== height ||
      this.layout.columns !== columns ||
      this.layout.rows !== rows
    ) {
      this.clearChunkTextures();
      this.layout = nextLayout;
    }
    return this.layout;
  }

  private getChunkTexture(layout: NebulaLayout, column: number, row: number): string {
    const cacheKey = `${column}:${row}`;
    const cached = this.textureCache.get(cacheKey);
    this.renderIndex += 1;
    if (cached) {
      cached.lastUsed = this.renderIndex;
      return cached.textureKey;
    }

    const textureKey = `${this.texturePrefix}-${column}-${row}`;
    this.createChunkTexture(layout, column, row, textureKey);
    this.textureCache.set(cacheKey, { lastUsed: this.renderIndex, textureKey });
    return textureKey;
  }

  private createChunkTexture(
    layout: NebulaLayout,
    column: number,
    row: number,
    textureKey: string,
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(Math.min(layout.chunkWidth, CHUNK_TEXTURE_SIZE)));
    canvas.height = Math.max(1, Math.round(Math.min(layout.chunkHeight, CHUNK_TEXTURE_SIZE)));
    const context = canvas.getContext('2d');
    if (context) {
      const imageData = context.createImageData(canvas.width, canvas.height);
      paintNebulaChunk(imageData, layout, column, row);
      context.putImageData(imageData, 0, 0);
    }
    this.scene.textures.addCanvas(textureKey, canvas);
  }

  private renderChunkImage(input: {
    displayHeight: number;
    displayWidth: number;
    imageIndex: number;
    textureKey: string;
    x: number;
    y: number;
  }): void {
    const displayWidth = Math.ceil(input.displayWidth) + 1;
    const displayHeight = Math.ceil(input.displayHeight) + 1;
    let image = this.images[input.imageIndex];
    if (!image) {
      image = this.scene.add
        .image(input.x, input.y, input.textureKey)
        .setName('sandbox-nebula-background-chunk')
        .setOrigin(0)
        .setScrollFactor(NEBULA_PARALLAX)
        .setDepth(NEBULA_DEPTH);
      this.images[input.imageIndex] = image;
    } else {
      image.setTexture(input.textureKey);
      image.setPosition(input.x, input.y);
    }
    image.setDisplaySize(displayWidth, displayHeight);
    image.setVisible(true);
  }

  private hideUnusedImages(firstUnusedIndex: number): void {
    for (let index = firstUnusedIndex; index < this.images.length; index += 1) {
      const image = this.images[index];
      image.setVisible(false);
      image.setTexture(this.blankTextureKey);
    }
  }

  private hideAllImages(): void {
    if (this.visible) {
      this.visible = false;
      for (const image of this.images) {
        image.setVisible(false);
        image.setTexture(this.blankTextureKey);
      }
    }
  }

  private pruneTextureCache(activeTextureKeys: Set<string>): void {
    if (this.textureCache.size <= MAX_CACHED_CHUNKS) return;
    const staleTextures = [...this.textureCache.entries()]
      .filter(([, cached]) => !activeTextureKeys.has(cached.textureKey))
      .sort(([, left], [, right]) => left.lastUsed - right.lastUsed);
    const removeCount = Math.max(0, this.textureCache.size - MAX_CACHED_CHUNKS);
    for (let index = 0; index < removeCount && index < staleTextures.length; index += 1) {
      const [cacheKey, cached] = staleTextures[index];
      this.removeTexture(cached.textureKey);
      this.textureCache.delete(cacheKey);
    }
  }

  private clearChunkTextures(): void {
    this.hideUnusedImages(0);
    for (const cached of this.textureCache.values()) this.removeTexture(cached.textureKey);
    this.textureCache.clear();
  }

  private removeTexture(textureKey: string): void {
    if (this.scene.textures.exists(textureKey)) this.scene.textures.remove(textureKey);
  }
}

function paintNebulaChunk(
  imageData: ImageData,
  layout: NebulaLayout,
  column: number,
  row: number,
): void {
  const pixels = imageData.data;
  const xScale = layout.chunkWidth / Math.max(1, imageData.width - 1);
  const yScale = layout.chunkHeight / Math.max(1, imageData.height - 1);
  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const worldX = column * layout.chunkWidth + x * xScale;
      const worldY = row * layout.chunkHeight + y * yScale;
      const color = sampleNebula(worldX / layout.width, worldY / layout.height);
      const offset = (y * imageData.width + x) * 4;
      pixels[offset] = color.r;
      pixels[offset + 1] = color.g;
      pixels[offset + 2] = color.b;
      pixels[offset + 3] = 255;
    }
  }
}

function sampleNebula(u: number, v: number): { b: number; g: number; r: number } {
  const warpX = fbmPeriodic(u * 5 + 8.3, v * 5 + 2.1, 5, 5, 4) - 0.5;
  const warpY = fbmPeriodic(u * 5 + 1.7, v * 5 + 9.6, 5, 5, 4) - 0.5;
  const bendX = Math.sin((u * 2 + v * 3) * TAU) * 0.018;
  const bendY = Math.cos((u * 3 - v * 2) * TAU) * 0.018;
  const curvedU = u + warpX * 0.085 + bendX;
  const curvedV = v + warpY * 0.085 + bendY;
  const broad = fbmPeriodic(curvedU * 6, curvedV * 6, 6, 6, 4);
  const cloud = fbmPeriodic(curvedU * 12 + 4.5, curvedV * 12 + 7.1, 12, 12, 3);
  const grain = fbmPeriodic(curvedU * 32 + warpX * 3.5, curvedV * 32 + warpY * 3.5, 32, 32, 2);
  const dust = fbmPeriodic(curvedU * 72 + warpY * 5, curvedV * 72 - warpX * 5, 72, 72, 1);
  const colorNoise = fbmPeriodic(curvedU * 9 + 12.4, curvedV * 9 + 3.7, 9, 9, 3);
  const ribbonA =
    Math.sin((curvedU * 5 + curvedV * 2 + warpX * 0.95 + warpY * 0.35) * TAU) * 0.5 + 0.5;
  const ribbonB =
    Math.cos((curvedU * 2 - curvedV * 6 + warpY * 0.9 - warpX * 0.25) * TAU) * 0.5 + 0.5;
  const grainRidge = 1 - Math.abs(grain * 2 - 1);
  const dustRidge = 1 - Math.abs(dust * 2 - 1);
  const cloudShape = broad * 0.52 + cloud * 0.34 + grainRidge * 0.14;
  const darkLane = smoothstep(0.5, 0.86, (1 - broad) * 0.46 + ribbonB * 0.24 + grain * 0.3);
  const cloudMass = smoothstep(0.3, 0.82, cloudShape);
  const smoky = smoothstep(0.38, 0.86, cloud * 0.42 + grainRidge * 0.34 + ribbonA * 0.24);
  const thread = smoothstep(0.72, 0.985, grainRidge * 0.48 + dustRidge * 0.38 + ribbonA * 0.14);
  const pin = smoothstep(0.9, 0.995, dustRidge * 0.62 + grainRidge * 0.28 + ribbonA * 0.1);
  const density = Phaser.Math.Clamp(
    cloudMass * 0.68 + smoky * 0.22 + thread * 0.18 + pin * 0.08 - darkLane * 0.36,
    0,
    1,
  );
  const base = { r: 2, g: 5, b: 17 };
  const blue = { r: 18, g: 54, b: 116 };
  const indigo = { r: 46, g: 38, b: 118 };
  const violet = { r: 92, g: 46, b: 132 };
  const teal = { r: 30, g: 114, b: 138 };
  const pearl = { r: 150, g: 156, b: 176 };
  const coldMix = mixColor(blue, indigo, smoothstep(0.18, 0.74, colorNoise));
  const warmMix = mixColor(violet, teal, smoothstep(0.42, 0.88, cloud));
  const gasColor = mixColor(coldMix, warmMix, smoothstep(0.36, 0.9, smoky));
  const highlight = mixColor(gasColor, pearl, thread * 0.2 + pin * 0.18);
  const laneShade = 1 - darkLane * 0.48;
  const localTexture = Phaser.Math.Clamp(
    0.72 + grainRidge * 0.18 + dustRidge * 0.14 + thread * 0.18 + pin * 0.14,
    0.56,
    1.18,
  );
  const glow = density * 0.9 + smoky * 0.12 + thread * 0.16 + pin * 0.12;

  return {
    b: clampByte((base.b + highlight.b * glow) * laneShade * localTexture),
    g: clampByte((base.g + highlight.g * glow) * laneShade * localTexture),
    r: clampByte((base.r + highlight.r * glow) * laneShade * localTexture),
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
  return Math.abs(Math.sin((wrappedX + 1) * 127.1 + (wrappedY + 1) * 311.7) * 43758.5453) % 1;
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
  const t = Phaser.Math.Clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function positiveModuloInteger(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
