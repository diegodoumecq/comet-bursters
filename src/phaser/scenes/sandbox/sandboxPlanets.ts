import Phaser from 'phaser';

import type { WorldSize } from '../../core/types';
import { createPlanet } from '../../planets/logic';
import type { PlanetEntity } from '../../planets/types';
import type { SandboxPlanetEntity } from './planetFuel';

const PLANET_COUNT = 8;
const PLANET_MARGIN = 900;

export function createSandboxPlanets(world: WorldSize): SandboxPlanetEntity[] {
  const planets: SandboxPlanetEntity[] = [];
  for (let index = 0; index < PLANET_COUNT; index += 1) {
    planets.push(createSeparatedPlanet(planets, world));
  }
  return planets;
}

function createSeparatedPlanet(existing: PlanetEntity[], world: WorldSize): SandboxPlanetEntity {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = withSandboxFuel(createPlanet(
      Phaser.Math.Between(PLANET_MARGIN, world.width - PLANET_MARGIN),
      Phaser.Math.Between(PLANET_MARGIN, world.height - PLANET_MARGIN),
    ));
    const separated = existing.every((planet) =>
      Phaser.Math.Distance.Between(
        candidate.position.x,
        candidate.position.y,
        planet.position.x,
        planet.position.y,
      ) > candidate.radius + planet.radius + 500,
    );
    if (separated) return candidate;
  }
  return withSandboxFuel(createPlanet(world.width * 0.5, world.height * 0.5));
}

function withSandboxFuel(planet: PlanetEntity): SandboxPlanetEntity {
  return {
    ...planet,
    extractor: {
      angle: Math.random() * Math.PI * 2,
      blobs: [],
      nextExtractAt: 0,
    },
    fuelReserve: Phaser.Math.Between(8, 30) * 5,
    inspectedUntil: 0,
    visualSeed: Math.random() * Math.PI * 2,
  };
}
