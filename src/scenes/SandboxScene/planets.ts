import {
  PLANET_CONFIG,
  PLANET_FUEL_EXTRACT_INTERVAL_MS,
  PLANET_FUEL_EXTRACTOR_MAX_BLOBS,
  PLANET_KINDS,
  PLANET_MAX_FUEL_RESERVE,
  PLANET_MAX_ROTATION_SPEED,
  PLANET_MIN_FUEL_RESERVE,
  PLANET_MIN_ROTATION_SPEED,
  type FuelExtractor,
  type Planet,
} from '@/constants';
import { drawStyledPlanet } from './planetVisuals';

export function createPlanet(x: number, y: number): Planet {
  const kind = PLANET_KINDS[Math.floor(Math.random() * PLANET_KINDS.length)];
  const palette = PLANET_CONFIG.palettes[kind];
  const color = palette[Math.floor(Math.random() * palette.length)];
  const variations: number[] = [];

  for (let i = 0; i < 32; i++) {
    variations.push(0.9 + Math.random() * 0.2);
  }

  const fuelSteps =
    Math.floor(
      (PLANET_MIN_FUEL_RESERVE +
        Math.random() * (PLANET_MAX_FUEL_RESERVE - PLANET_MIN_FUEL_RESERVE)) /
        5,
    ) * 5;
  const rotationDirection = Math.random() < 0.5 ? -1 : 1;
  const rotationSpeed =
    rotationDirection *
    (PLANET_MIN_ROTATION_SPEED +
      Math.random() * (PLANET_MAX_ROTATION_SPEED - PLANET_MIN_ROTATION_SPEED));
  const extractors: FuelExtractor[] = [
    {
      id: `extractor-${Math.round(x)}-${Math.round(y)}-0`,
      anchorAngle: Math.random() * Math.PI * 2,
      extractIntervalMs: PLANET_FUEL_EXTRACT_INTERVAL_MS,
      nextExtractAt: Date.now() + Math.random() * PLANET_FUEL_EXTRACT_INTERVAL_MS,
      maxBlobs: PLANET_FUEL_EXTRACTOR_MAX_BLOBS,
      blobs: [],
    },
  ];

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    kind,
    color,
    altitudeVariations: variations,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed,
    fuelReserve: fuelSteps,
    fuelExtractors: extractors,
    inspectedUntil: 0,
    getRadius: () => PLANET_CONFIG.radius,
    mask: null,
  };
}

export function drawPlanet(planet: Planet, ctx: CanvasRenderingContext2D): void {
  drawStyledPlanet(planet, ctx);
}
