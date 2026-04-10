import { PLANET_CONFIG, PLANET_KINDS, type Planet } from '@/constants';
import { drawStyledPlanet } from './planetVisuals';

export function createPlanet(x: number, y: number): Planet {
  const kind = PLANET_KINDS[Math.floor(Math.random() * PLANET_KINDS.length)];
  const palette = PLANET_CONFIG.palettes[kind];
  const color = palette[Math.floor(Math.random() * palette.length)];
  const variations: number[] = [];

  for (let i = 0; i < 32; i++) {
    variations.push(0.9 + Math.random() * 0.2);
  }

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    kind,
    color,
    altitudeVariations: variations,
    rotation: Math.random() * Math.PI * 2,
    getRadius: () => PLANET_CONFIG.radius,
    mask: null,
  };
}

export function drawPlanet(planet: Planet, ctx: CanvasRenderingContext2D): void {
  drawStyledPlanet(planet, ctx);
}
