import type { PlanetShapeSource as Planet } from '../types';
import { tracePlanetShape } from './planetShapes';

type Crescent = {
  color: string;
  mask: {
    radius: number;
    x: number;
    y: number;
  };
};

const LIGHT_CRESCENTS: Crescent[] = [
  {
    color: 'rgba(255, 255, 255, 0.08)',
    mask: { radius: 1, x: 0.072, y: 0.072 },
  },
  {
    color: 'rgba(255, 255, 255, 0.14)',
    mask: { radius: 1, x: 0.048, y: 0.048 },
  },
  {
    color: 'rgba(255, 255, 255, 0.24)',
    mask: { radius: 1, x: 0.026, y: 0.026 },
  },
];

const SHADOW_CRESCENTS: Crescent[] = [
  {
    color: 'rgba(0, 0, 0, 0.055)',
    mask: { radius: 1, x: -0.5, y: -0.5 },
  },
  {
    color: 'rgba(0, 0, 0, 0.11)',
    mask: { radius: 1, x: -0.16, y: -0.16 },
  },
  {
    color: 'rgba(0, 0, 0, 0.16)',
    mask: { radius: 1, x: -0.11, y: -0.11 },
  },
  {
    color: 'rgba(0, 0, 0, 0.24)',
    mask: { radius: 1, x: -0.07, y: -0.07 },
  },
];

export function drawPlanetLightingLayer(planet: Planet, ctx: CanvasRenderingContext2D): void {
  const radius = planet.getRadius();

  ctx.save();
  ctx.translate(planet.x, planet.y);

  ctx.save();
  tracePlanetShape(ctx, planet, radius);
  ctx.clip();

  drawCrescents(ctx, radius, SHADOW_CRESCENTS);
  drawCrescents(ctx, radius, LIGHT_CRESCENTS);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = Math.max(1.5, radius * 0.018);
  tracePlanetShape(ctx, planet, radius * 0.985);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(3, 6, 12, 0.42)';
  ctx.lineWidth = Math.max(1, radius * 0.006);
  tracePlanetShape(ctx, planet, radius);
  ctx.stroke();

  ctx.restore();
}

function drawCrescents(ctx: CanvasRenderingContext2D, radius: number, crescents: Crescent[]): void {
  for (const crescent of crescents) {
    drawCrescent(ctx, radius, crescent);
  }
}

function drawCrescent(ctx: CanvasRenderingContext2D, radius: number, crescent: Crescent): void {
  ctx.save();
  ctx.fillStyle = crescent.color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.arc(
    crescent.mask.x * radius,
    crescent.mask.y * radius,
    crescent.mask.radius * radius,
    0,
    Math.PI * 2,
  );
  ctx.fill('evenodd');
  ctx.restore();
}
