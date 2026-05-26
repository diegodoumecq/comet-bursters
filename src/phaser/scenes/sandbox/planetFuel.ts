import { circlesOverlap } from '../../core/collision';
import type { Vector } from '../../core/types';
import { FUEL_BLOB_AMOUNT, FUEL_BLOB_RADIUS } from '../../fuel/rules';
import type { FuelBlobEntity } from '../../fuel/types';
import type { PlanetEntity } from '../../planets/types';
import { PLAYER_COLLISION_RADIUS } from '../../player/config';
import { wrappedDelta } from '../../world/geometry';

const EXTRACT_INTERVAL_MS = 1800;
const EXTRACTOR_ALTITUDE = 52;
const MAX_EXTRACTOR_BLOBS = 8;

export type ExtractorFuelBlob = {
  localOffsetX: number;
  localOffsetY: number;
  wobbleSeed: number;
};

export type SandboxPlanetEntity = PlanetEntity & {
  extractor: {
    angle: number;
    blobs: ExtractorFuelBlob[];
    nextExtractAt: number;
  };
  fuelReserve: number;
  inspectedUntil: number;
  visualSeed: number;
};

export function updatePlanetFuel(
  planets: SandboxPlanetEntity[],
  now: number,
  deltaSeconds: number,
): void {
  for (const planet of planets) {
    planet.rotation += planet.rotationSpeed * deltaSeconds * 1000;
    if (planet.extractor.nextExtractAt === 0) {
      planet.extractor.nextExtractAt = now + Math.random() * EXTRACT_INTERVAL_MS;
    }
    if (now >= planet.extractor.nextExtractAt) {
      planet.extractor.nextExtractAt = now + EXTRACT_INTERVAL_MS;
      if (
        planet.fuelReserve >= FUEL_BLOB_AMOUNT &&
        planet.extractor.blobs.length < MAX_EXTRACTOR_BLOBS
      ) {
        planet.fuelReserve -= FUEL_BLOB_AMOUNT;
        planet.extractor.blobs.push({
          localOffsetX: (Math.random() - 0.5) * 54,
          localOffsetY: (Math.random() - 0.5) * 24,
          wobbleSeed: Math.random(),
        });
      }
    }
  }
}

export function absorbFuelIntoPlanets(
  blobs: FuelBlobEntity[],
  planets: SandboxPlanetEntity[],
  world: { width: number; height: number },
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

export function getExtractorPosition(planet: SandboxPlanetEntity): Vector {
  return {
    x: planet.position.x + Math.cos(planet.extractor.angle) * (planet.radius + EXTRACTOR_ALTITUDE),
    y: planet.position.y + Math.sin(planet.extractor.angle) * (planet.radius + EXTRACTOR_ALTITUDE),
  };
}

export function getExtractorBlobPosition(
  planet: SandboxPlanetEntity,
  blob: ExtractorFuelBlob,
  now: number,
): Vector {
  const angle = planet.extractor.angle;
  const normal = { x: Math.cos(angle), y: Math.sin(angle) };
  const tangent = { x: -normal.y, y: normal.x };
  const center = {
    x: planet.position.x + normal.x * (planet.radius + EXTRACTOR_ALTITUDE + 34),
    y: planet.position.y + normal.y * (planet.radius + EXTRACTOR_ALTITUDE + 34),
  };
  const wobble = Math.sin(now * 0.003 + blob.wobbleSeed * Math.PI * 2) * 4;
  return {
    x: center.x + tangent.x * blob.localOffsetX + normal.x * (blob.localOffsetY + wobble),
    y: center.y + tangent.y * blob.localOffsetX + normal.y * (blob.localOffsetY + wobble),
  };
}

export function collectExtractorFuel(
  planets: SandboxPlanetEntity[],
  player: Vector,
  canCollect: boolean,
  now: number,
  playerCollisionRadius = PLAYER_COLLISION_RADIUS,
): number {
  if (!canCollect) return 0;
  let fuelGain = 0;
  for (const planet of planets) {
    const remaining: ExtractorFuelBlob[] = [];
    for (const blob of planet.extractor.blobs) {
      const position = getExtractorBlobPosition(planet, blob, now);
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
