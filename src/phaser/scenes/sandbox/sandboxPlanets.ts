import Phaser from 'phaser';

import type { WorldSize } from '../../core/types';
import {
  createFuelExtractionPlanet,
  type FuelExtractionPlanetEntity,
} from '../../planets/fuelExtraction';
import { createPlanet } from '../../planets/logic';
import type { PlanetEntity } from '../../planets/types';

const PLANET_COUNT = 40;
const PLANET_MARGIN = 2000;

export function createSandboxPlanets(world: WorldSize): FuelExtractionPlanetEntity[] {
  const planets: FuelExtractionPlanetEntity[] = [];
  for (let index = 0; index < PLANET_COUNT; index += 1) {
    planets.push(createSeparatedPlanet(planets, world));
  }
  return planets;
}

function createSeparatedPlanet(
  existing: PlanetEntity[],
  world: WorldSize,
): FuelExtractionPlanetEntity {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = withSandboxFuel(
      createPlanet(
        Phaser.Math.Between(PLANET_MARGIN, world.width - PLANET_MARGIN),
        Phaser.Math.Between(PLANET_MARGIN, world.height - PLANET_MARGIN),
      ),
    );
    const separated = existing.every(
      (planet) =>
        Phaser.Math.Distance.Between(
          candidate.position.x,
          candidate.position.y,
          planet.position.x,
          planet.position.y,
        ) >
        candidate.radius + planet.radius + 500,
    );
    if (separated) return candidate;
  }
  return withSandboxFuel(createPlanet(world.width * 0.5, world.height * 0.5));
}

function withSandboxFuel(planet: PlanetEntity): FuelExtractionPlanetEntity {
  return createFuelExtractionPlanet(planet);
}
