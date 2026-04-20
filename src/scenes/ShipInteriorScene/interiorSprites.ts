import { drawTilemapLayer } from '@/spritesheet';

import type { LoadedShipInteriorLayer } from './level';

export class ShipInteriorSpriteRenderer {
  drawLayers(ctx: CanvasRenderingContext2D, layers: LoadedShipInteriorLayer[]): boolean {
    if (layers.length === 0) {
      return false;
    }

    for (const layer of layers) {
      drawTilemapLayer(ctx, layer.sheet, layer.tilemap);
    }

    return true;
  }
}
