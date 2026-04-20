import type { SpriteSheet } from './SpriteSheet';
import type { TilePlacement, TilemapLayer } from './types';

export function createTilePlacement(
  frame: TilePlacement['frame'],
  tileX: number,
  tileY: number,
  overrides: Omit<TilePlacement, 'frame' | 'tileX' | 'tileY'> = {},
): TilePlacement {
  return {
    frame,
    tileX,
    tileY,
    ...overrides,
  };
}

export function drawTilemapLayer(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  layer: TilemapLayer,
): void {
  const offsetX = layer.offsetX ?? 0;
  const offsetY = layer.offsetY ?? 0;

  for (const tile of layer.tiles) {
    sheet.drawFrame(ctx, tile.frame, {
      x: offsetX + tile.tileX * layer.tileWidth,
      y: offsetY + tile.tileY * layer.tileHeight,
      width: tile.width ?? layer.tileWidth,
      height: tile.height ?? layer.tileHeight,
      rotation: tile.rotation,
      alpha: tile.alpha,
    });
  }
}
