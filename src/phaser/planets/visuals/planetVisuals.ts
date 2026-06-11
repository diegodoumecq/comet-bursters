import type { PlanetSpriteSource as Planet } from '../types';
import { tracePlanetShape } from './planetShapes';
import { drawPlanetSurface } from './planetSurfaces';

const LIGHT_DIRECTION = { x: -0.58, y: -0.42 };
const BODY_EXTENT_SCALE = 1.08;
const BODY_FILL_SIZE = 2.16;

export function drawPlanetSurfaceLayer(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const radius = planet.getRadius();

  ctx.save();
  ctx.translate(planet.x, planet.y);

  tracePlanetShape(ctx, planet, radius);
  ctx.fillStyle = planet.color;
  ctx.fill();

  ctx.save();
  tracePlanetShape(ctx, planet, radius);
  ctx.clip();
  drawPlanetSurface(planet, ctx, radius);
  ctx.restore();
  ctx.restore();
}

export function drawPlanetLightingLayer(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const radius = planet.getRadius();
  const lightOffset = {
    x: LIGHT_DIRECTION.x * radius * 0.42,
    y: LIGHT_DIRECTION.y * radius * 0.42,
  };
  const shadowOffset = {
    x: -LIGHT_DIRECTION.x * radius,
    y: -LIGHT_DIRECTION.y * radius,
  };

  ctx.save();
  ctx.translate(planet.x, planet.y);

  ctx.save();
  tracePlanetShape(ctx, planet, radius);
  ctx.clip();

  const directionalShade = ctx.createLinearGradient(
    lightOffset.x,
    lightOffset.y,
    shadowOffset.x,
    shadowOffset.y,
  );
  directionalShade.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
  directionalShade.addColorStop(0.28, 'rgba(255, 255, 255, 0.035)');
  directionalShade.addColorStop(0.54, 'rgba(0, 0, 0, 0.08)');
  directionalShade.addColorStop(0.82, 'rgba(0, 0, 0, 0.36)');
  directionalShade.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
  ctx.fillStyle = directionalShade;
  fillPlanetLightingBounds(ctx, radius);

  const highlight = ctx.createRadialGradient(
    lightOffset.x,
    lightOffset.y,
    radius * 0.02,
    lightOffset.x,
    lightOffset.y,
    radius * 0.95,
  );
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  highlight.addColorStop(0.34, 'rgba(255, 255, 255, 0.08)');
  highlight.addColorStop(0.72, 'rgba(255, 255, 255, 0.018)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlight;
  fillPlanetLightingBounds(ctx, radius);

  const limbShade = ctx.createRadialGradient(
    0,
    0,
    radius * 0.48,
    0,
    0,
    radius * BODY_EXTENT_SCALE,
  );
  limbShade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  limbShade.addColorStop(0.58, 'rgba(0, 0, 0, 0)');
  limbShade.addColorStop(0.86, 'rgba(0, 0, 0, 0.16)');
  limbShade.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
  ctx.fillStyle = limbShade;
  fillPlanetLightingBounds(ctx, radius);
  ctx.restore();

  const litRim = ctx.createLinearGradient(
    radius * -0.78,
    radius * -0.78,
    radius * 0.45,
    radius * 0.45,
  );
  litRim.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  litRim.addColorStop(0.32, 'rgba(255, 255, 255, 0.09)');
  litRim.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.strokeStyle = litRim;
  ctx.lineWidth = Math.max(1.5, radius * 0.018);
  tracePlanetShape(ctx, planet, radius * 0.985);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(3, 6, 12, 0.42)';
  ctx.lineWidth = Math.max(1, radius * 0.006);
  tracePlanetShape(ctx, planet, radius);
  ctx.stroke();

  ctx.restore();
}

function fillPlanetLightingBounds(ctx: CanvasRenderingContext2D, radius: number): void {
  const size = radius * BODY_FILL_SIZE;
  ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
}
