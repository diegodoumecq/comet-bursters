import Phaser from 'phaser';

import type { PlanetEntity, WorldSize } from '../../model';
import { createPlanet } from '../../services/planets';

export function createSandboxPlanets(scene: Phaser.Scene, world: WorldSize, count: number): PlanetEntity[] {
  const planets: PlanetEntity[] = [];
  const margin = 1400;
  for (let index = 0; index < count; index += 1) {
    let candidate = randomPosition(world, margin);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const tooClose = planets.some((planet) =>
        Phaser.Math.Distance.Between(planet.body.x, planet.body.y, candidate.x, candidate.y) < planet.radius * 4,
      );
      if (!tooClose) break;
      candidate = randomPosition(world, margin);
    }
    planets.push(createPlanet(scene, candidate.x, candidate.y));
  }
  return planets;
}

function randomPosition(world: WorldSize, margin: number): { x: number; y: number } {
  return {
    x: margin + Math.random() * (world.width - margin * 2),
    y: margin + Math.random() * (world.height - margin * 2),
  };
}
