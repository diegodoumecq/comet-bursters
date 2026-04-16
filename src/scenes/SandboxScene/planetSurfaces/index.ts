import type { Planet, PlanetKind } from '@/constants';

import { drawCrystalSurface } from './crystal';
import { drawDesertSurface } from './desert';
import { drawGasSurface } from './gas';
import { drawIceSurface } from './ice';
import { drawLavaSurface } from './lava';
import { drawLushSurface } from './lush';
import { drawToxicSurface } from './toxic';

const surfaceRenderers: Record<
  PlanetKind,
  (planet: Planet, ctx: CanvasRenderingContext2D, radius: number) => void
> = {
  lush: drawLushSurface,
  desert: drawDesertSurface,
  ice: drawIceSurface,
  lava: drawLavaSurface,
  gas: drawGasSurface,
  toxic: drawToxicSurface,
  crystal: drawCrystalSurface,
};

export function drawPlanetSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  surfaceRenderers[planet.kind](planet, ctx, radius);
}
