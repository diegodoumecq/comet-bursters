import type { Planet } from '@/constants';

type FlatTexturePainter = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: Planet,
) => void;

const flatTextureCache = new Map<string, HTMLCanvasElement>();

export function clearFlatPlanetTextureCache(): void {
  flatTextureCache.clear();
}

function normalizeRotation(rotation: number): number {
  const fullTurn = Math.PI * 2;
  const normalized = rotation % fullTurn;
  return normalized < 0 ? normalized + fullTurn : normalized;
}

export function getFlatPlanetTexture(
  cacheKey: string,
  width: number,
  height: number,
  planet: Planet,
  painter: FlatTexturePainter,
): HTMLCanvasElement {
  const cached = flatTextureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const textureCtx = canvas.getContext('2d');
  if (!textureCtx) {
    return canvas;
  }

  painter(textureCtx, width, height, planet);
  flatTextureCache.set(cacheKey, canvas);
  return canvas;
}

export function drawFlatTextureOnSphere(
  ctx: CanvasRenderingContext2D,
  texture: HTMLCanvasElement,
  radius: number,
  rotation: number,
): void {
  const diameter = Math.ceil(radius * 2);
  const textureHeight = texture.height;
  const textureWidth = texture.width;
  const rotationOffset = (normalizeRotation(rotation) / (Math.PI * 2)) * textureWidth;

  for (let y = 0; y < diameter; y++) {
    const v = ((y + 0.5) / diameter) * 2 - 1;
    const bandRadius = Math.sqrt(Math.max(0, 1 - v * v));
    if (bandRadius <= 0.001) {
      continue;
    }

    const destWidth = Math.max(1, bandRadius * diameter);
    const destX = -destWidth / 2;
    const destY = y - radius;
    const srcY = Math.min(textureHeight - 1, Math.max(0, Math.floor(((v + 1) * 0.5) * textureHeight)));
    const srcX = rotationOffset % textureWidth;
    const firstSliceWidth = Math.min(textureWidth - srcX, textureWidth);

    ctx.drawImage(texture, srcX, srcY, firstSliceWidth, 1, destX, destY, destWidth * (firstSliceWidth / textureWidth), 1);

    if (firstSliceWidth < textureWidth) {
      const remainingWidth = textureWidth - firstSliceWidth;
      ctx.drawImage(
        texture,
        0,
        srcY,
        remainingWidth,
        1,
        destX + destWidth * (firstSliceWidth / textureWidth),
        destY,
        destWidth * (remainingWidth / textureWidth),
        1,
      );
    }
  }
}
