import Phaser from 'phaser';

import type { WorldSize } from '../../core/types';
import { createPlanet } from '../../planets/logic';
import type { PlanetEntity } from '../../planets/types';

const PLANET_COUNT = 8;
const PLANET_MARGIN = 900;

export function createSandboxPlanets(world: WorldSize): PlanetEntity[] {
  const planets: PlanetEntity[] = [];
  for (let index = 0; index < PLANET_COUNT; index += 1) {
    planets.push(createSeparatedPlanet(planets, world));
  }
  return planets;
}

function createSeparatedPlanet(existing: PlanetEntity[], world: WorldSize): PlanetEntity {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = createPlanet(
      Phaser.Math.Between(PLANET_MARGIN, world.width - PLANET_MARGIN),
      Phaser.Math.Between(PLANET_MARGIN, world.height - PLANET_MARGIN),
    );
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
  return createPlanet(world.width * 0.5, world.height * 0.5);
}
