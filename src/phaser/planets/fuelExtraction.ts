import { circlesOverlap } from '../core/collision';
import { createMathRandomSource, type RandomSource } from '../core/random';
import type { Vector, WorldSize } from '../core/types';
import { FUEL_BLOB_AMOUNT, FUEL_BLOB_RADIUS } from '../fuel/definition';
import type { FuelBlobEntity } from '../fuel/types';
import { PLAYER_COLLISION_RADIUS } from '../player/config';
import { wrappedDelta } from '../world/geometry';
import { PLANET_SPECS } from './config';
import type { PlanetEntity } from './types';

const EXTRACT_INTERVAL_MS = 1800;
const EXTRACTOR_ALTITUDE = 8;
const EXTRACTOR_FUEL_BLOB_ALTITUDE = 92;
const MAX_EXTRACTOR_BLOBS = 8;

export type FuelExtractorBlob = {
  localOffsetX: number;
  localOffsetY: number;
  wobbleSeed: number;
};

export type FuelExtractorState = {
  angle: number;
  blobs: FuelExtractorBlob[];
  nextExtractAt: number;
};

export type FuelExtractionPlanetEntity = PlanetEntity & {
  extractor: FuelExtractorState;
  fuelReserve: number;
  inspectedUntil: number;
  visualSeed: number;
};

export function createFuelExtractionPlanet(
  planet: PlanetEntity,
  random: RandomSource = createMathRandomSource(),
): FuelExtractionPlanetEntity {
  return {
    ...planet,
    extractor: {
      angle: random.float() * Math.PI * 2,
      blobs: [],
      nextExtractAt: 0,
    },
    fuelReserve: getFuelReserveForExtractionPlanet(planet, random),
    inspectedUntil: 0,
    visualSeed: random.float() * Math.PI * 2,
  };
}

export function updateFuelExtractionPlanets(
  planets: FuelExtractionPlanetEntity[],
  now: number,
  deltaSeconds: number,
  random: RandomSource = createMathRandomSource(),
): void {
  for (const planet of planets) {
    planet.rotation += planet.rotationSpeed * deltaSeconds * 1000;
    if (planet.extractor.nextExtractAt === 0) {
      planet.extractor.nextExtractAt = now + random.float() * EXTRACT_INTERVAL_MS;
    }
    if (now >= planet.extractor.nextExtractAt) {
      planet.extractor.nextExtractAt = now + EXTRACT_INTERVAL_MS;
      const canExtract =
        planet.fuelReserve >= FUEL_BLOB_AMOUNT &&
        planet.extractor.blobs.length < MAX_EXTRACTOR_BLOBS;
      if (canExtract) {
        planet.fuelReserve -= FUEL_BLOB_AMOUNT;
        planet.extractor.blobs.push({
          localOffsetX: (random.float() - 0.5) * 54,
          localOffsetY: (random.float() - 0.5) * 24,
          wobbleSeed: random.float(),
        });
      }
    }
  }
}

export function absorbFuelIntoExtractionPlanets(
  blobs: FuelBlobEntity[],
  planets: FuelExtractionPlanetEntity[],
  world: WorldSize,
): FuelBlobEntity[] {
  const absorbed: FuelBlobEntity[] = [];
  for (const blob of blobs) {
    const planet = planets.find((candidate) => {
      const delta = wrappedDelta(blob.position, candidate.position, world);
      return Math.hypot(delta.x, delta.y) <= candidate.radius + FUEL_BLOB_RADIUS;
    });
    if (planet) {
      planet.fuelReserve += FUEL_BLOB_AMOUNT;
      absorbed.push(blob);
    }
  }
  return absorbed;
}

export function getFuelExtractorWorldAngle(planet: FuelExtractionPlanetEntity): number {
  return planet.rotation + planet.extractor.angle;
}

export function getFuelExtractorPosition(planet: FuelExtractionPlanetEntity): Vector {
  const angle = getFuelExtractorWorldAngle(planet);
  return {
    x: planet.position.x + Math.cos(angle) * (planet.radius + EXTRACTOR_ALTITUDE),
    y: planet.position.y + Math.sin(angle) * (planet.radius + EXTRACTOR_ALTITUDE),
  };
}

export function getFuelExtractorBlobPosition(
  planet: FuelExtractionPlanetEntity,
  blob: FuelExtractorBlob,
  now: number,
): Vector {
  const angle = getFuelExtractorWorldAngle(planet);
  const normal = { x: Math.cos(angle), y: Math.sin(angle) };
  const tangent = { x: -normal.y, y: normal.x };
  const center = {
    x: planet.position.x + normal.x * (planet.radius + EXTRACTOR_FUEL_BLOB_ALTITUDE),
    y: planet.position.y + normal.y * (planet.radius + EXTRACTOR_FUEL_BLOB_ALTITUDE),
  };
  const wobble = Math.sin(now * 0.003 + blob.wobbleSeed * Math.PI * 2) * 4;
  return {
    x: center.x + tangent.x * blob.localOffsetX + normal.x * (blob.localOffsetY + wobble),
    y: center.y + tangent.y * blob.localOffsetX + normal.y * (blob.localOffsetY + wobble),
  };
}

export function collectFuelExtractorBlobs(
  planets: FuelExtractionPlanetEntity[],
  player: Vector,
  canCollect: boolean,
  now: number,
  playerCollisionRadius = PLAYER_COLLISION_RADIUS,
): number {
  if (!canCollect) return 0;
  let fuelGain = 0;
  for (const planet of planets) {
    const remaining: FuelExtractorBlob[] = [];
    for (const blob of planet.extractor.blobs) {
      const position = getFuelExtractorBlobPosition(planet, blob, now);
      if (
        circlesOverlap(
          Math.hypot(player.x - position.x, player.y - position.y),
          playerCollisionRadius,
          FUEL_BLOB_RADIUS,
        )
      ) {
        fuelGain += FUEL_BLOB_AMOUNT;
      } else {
        remaining.push(blob);
      }
    }
    planet.extractor.blobs = remaining;
  }
  return fuelGain;
}

function getFuelReserveForExtractionPlanet(planet: PlanetEntity, random: RandomSource): number {
  const range = PLANET_SPECS[planet.kind].fuelReserveRange;
  return Math.floor((range.min + random.float() * (range.max - range.min)) / 5) * 5;
}
