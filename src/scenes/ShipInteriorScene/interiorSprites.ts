import { drawTilemapLayer } from '@/spritesheet';

import type { LoadedShipInteriorLayer } from './level';

export class ShipInteriorSpriteRenderer {
  drawLayers(
    ctx: CanvasRenderingContext2D,
    layers: LoadedShipInteriorLayer[],
    options: { overhead?: boolean } = {},
  ): boolean {
    const drawableLayers = layers.filter((layer) => layer.overhead === (options.overhead ?? false));
    if (drawableLayers.length === 0) {
      return false;
    }

    for (const layer of drawableLayers) {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      drawTilemapLayer(ctx, layer.sheet, layer.tilemap);
      ctx.restore();
    }

    return true;
  }
}
