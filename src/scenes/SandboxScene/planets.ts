import {
  PLANET_CONFIG,
  PLANET_FUEL_EXTRACT_INTERVAL_MS,
  PLANET_FUEL_EXTRACTOR_MAX_BLOBS,
  PLANET_MAX_ROTATION_SPEED,
  PLANET_MIN_ROTATION_SPEED,
  type FuelExtractor,
  type PlanetKind,
  type Planet,
} from '@/constants';
import { drawStyledPlanet } from './planetVisuals';

const planetKinds = Object.keys(PLANET_CONFIG) as PlanetKind[];

function getFuelReserveForPlanetKind(kind: PlanetKind): number {
  const range = PLANET_CONFIG[kind].fuelReserveRange;
  return Math.floor((range.min + Math.random() * (range.max - range.min)) / 5) * 5;
}

export function createPlanet(x: number, y: number): Planet {
  const kind = planetKinds[Math.floor(Math.random() * planetKinds.length)];
  const config = PLANET_CONFIG[kind];
  const palette = config.palette;
  const color = palette[Math.floor(Math.random() * palette.length)];
  const variations: number[] = [];

  for (let i = 0; i < 32; i++) {
    variations.push(0.9 + Math.random() * 0.2);
  }

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
    fuelReserve: getFuelReserveForPlanetKind(kind),
    fuelExtractors: extractors,
    inspectedUntil: 0,
    getRadius: () => config.radius,
    mask: null,
  };
}

export function drawPlanet(planet: Planet, ctx: CanvasRenderingContext2D): void {
  drawStyledPlanet(planet, ctx);
}
