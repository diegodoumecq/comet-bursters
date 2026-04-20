import type {
  DrawSpriteFrameOptions,
  SpriteSheetFrame,
  SpriteSheetFrameSelector,
  SpriteSheetGridConfig,
} from './types';

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function resolveAxisFrameCount(
  axisName: 'columns' | 'rows',
  availablePixels: number,
  frameSize: number,
  gap: number,
  explicitCount?: number,
): number {
  if (explicitCount !== undefined) {
    assertPositiveInteger(explicitCount, axisName);
    return explicitCount;
  }

  const step = frameSize + gap;
  const inferred = Math.floor((availablePixels + gap) / step);
  if (inferred <= 0) {
    throw new Error(`Unable to infer ${axisName} for the provided spritesheet grid.`);
  }

  return inferred;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load spritesheet image: ${src}`));
    image.src = src;
  });
}

export class SpriteSheet {
  readonly image: HTMLImageElement;
  readonly config: Readonly<Required<Omit<SpriteSheetGridConfig, 'namedFrames'>>>;
  readonly frames: readonly SpriteSheetFrame[];

  private readonly namedFrames: Readonly<Record<string, SpriteSheetFrameSelector>>;

  constructor(image: HTMLImageElement, config: SpriteSheetGridConfig) {
    assertPositiveInteger(config.frameWidth, 'frameWidth');
    assertPositiveInteger(config.frameHeight, 'frameHeight');

    const offsetX = config.offsetX ?? 0;
    const offsetY = config.offsetY ?? 0;
    const gapX = config.gapX ?? 0;
    const gapY = config.gapY ?? 0;

    assertNonNegativeInteger(offsetX, 'offsetX');
    assertNonNegativeInteger(offsetY, 'offsetY');
    assertNonNegativeInteger(gapX, 'gapX');
    assertNonNegativeInteger(gapY, 'gapY');

    const availableWidth = image.width - offsetX;
    const availableHeight = image.height - offsetY;
    if (availableWidth < config.frameWidth || availableHeight < config.frameHeight) {
      throw new Error('Spritesheet image is smaller than the configured frame bounds.');
    }

    const columns = resolveAxisFrameCount(
      'columns',
      availableWidth,
      config.frameWidth,
      gapX,
      config.columns,
    );
    const rows = resolveAxisFrameCount(
      'rows',
      availableHeight,
      config.frameHeight,
      gapY,
      config.rows,
    );

    const maxFrameCount = columns * rows;
    const frameCount = config.frameCount ?? maxFrameCount;
    assertPositiveInteger(frameCount, 'frameCount');

    if (frameCount > maxFrameCount) {
      throw new Error('frameCount exceeds the grid capacity defined by columns and rows.');
    }

    this.image = image;
    this.config = {
      frameWidth: config.frameWidth,
      frameHeight: config.frameHeight,
      offsetX,
      offsetY,
      gapX,
      gapY,
      columns,
      rows,
      frameCount,
    };
    this.namedFrames = config.namedFrames ?? {};
    this.frames = this.buildFrames();
  }

  static async fromUrl(src: string, config: SpriteSheetGridConfig): Promise<SpriteSheet> {
    const image = await loadImage(src);
    return new SpriteSheet(image, config);
  }

  getFrame(selector: SpriteSheetFrameSelector): SpriteSheetFrame {
    if (typeof selector === 'number') {
      const frame = this.frames[selector];
      if (!frame) {
        throw new Error(`Sprite frame index ${selector} is out of range.`);
      }
      return frame;
    }

    if ('name' in selector) {
      const namedSelector = this.namedFrames[selector.name];
      if (!namedSelector) {
        throw new Error(`Unknown sprite frame name: ${selector.name}`);
      }
      return this.getFrame(namedSelector);
    }

    const { column, row } = selector;
    if (column < 0 || column >= this.config.columns || row < 0 || row >= this.config.rows) {
      throw new Error(`Sprite frame cell (${column}, ${row}) is out of range.`);
    }

    const index = row * this.config.columns + column;
    return this.getFrame(index);
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    selector: SpriteSheetFrameSelector,
    options: DrawSpriteFrameOptions,
  ): void {
    const frame = this.getFrame(selector);
    const width = options.width ?? frame.width;
    const height = options.height ?? frame.height;
    const originX = options.originX ?? 0;
    const originY = options.originY ?? 0;
    const rotation = options.rotation ?? 0;
    const alpha = options.alpha ?? 1;

    ctx.save();
    ctx.translate(options.x, options.y);
    if (rotation !== 0) {
      ctx.rotate(rotation);
    }
    if (alpha !== 1) {
      ctx.globalAlpha *= alpha;
    }
    ctx.drawImage(
      this.image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      -originX,
      -originY,
      width,
      height,
    );
    ctx.restore();
  }

  private buildFrames(): SpriteSheetFrame[] {
    const frames: SpriteSheetFrame[] = [];
    const { frameWidth, frameHeight, offsetX, offsetY, gapX, gapY, columns, frameCount } =
      this.config;

    for (let index = 0; index < frameCount; index++) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      frames.push({
        index,
        column,
        row,
        x: offsetX + column * (frameWidth + gapX),
        y: offsetY + row * (frameHeight + gapY),
        width: frameWidth,
        height: frameHeight,
      });
    }

    return frames;
  }
}

export async function loadSpriteSheet(
  src: string,
  config: SpriteSheetGridConfig,
): Promise<SpriteSheet> {
  return SpriteSheet.fromUrl(src, config);
}
