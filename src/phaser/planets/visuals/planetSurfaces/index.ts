import type { PlanetSpriteSource as Planet, PlanetKind } from '../../types';
import { drawCrystalSurface } from './crystal';
import { drawDesertSurface } from './desert';
import { drawGasSurface } from './gas';
import { drawIceSurface } from './ice';
import { drawLushSurface } from './lush';

const surfaceRenderers: Partial<
  Record<PlanetKind, (planet: Planet, ctx: CanvasRenderingContext2D, radius: number) => void>
> = {
  lush: drawLushSurface,
  desert: drawDesertSurface,
  ice: drawIceSurface,
  gas: drawGasSurface,
  crystal: drawCrystalSurface,
};

export function drawPlanetSurface(
  planet: Planet,
  ctx: CanvasRenderingContext2D,
  radius: number,
): void {
  const renderer = surfaceRenderers[planet.kind];
  if (!renderer) throw new Error(`${planet.kind} planets are rendered by shader textures`);
  renderer(planet, ctx, radius);
}
