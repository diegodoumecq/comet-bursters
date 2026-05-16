import Phaser from 'phaser';

import type { PlanetEntity, WorldSize } from '../model';

type PlanetSpec = {
  color: number;
  gravityStrength: number;
  radius: number;
};

const PLANETS: PlanetSpec[] = [
  { color: 0x2ecc71, gravityStrength: 0.5, radius: 250 },
  { color: 0xf39c12, gravityStrength: 0.5, radius: 250 },
  { color: 0x8bd3ff, gravityStrength: 0.5, radius: 250 },
  { color: 0xe74c3c, gravityStrength: 0.5, radius: 450 },
  { color: 0x9b59b6, gravityStrength: 0.5, radius: 700 },
  { color: 0x1abc9c, gravityStrength: 0.5, radius: 350 },
  { color: 0x8ef6ff, gravityStrength: 1, radius: 300 },
];

export function createPlanet(
  scene: Phaser.Scene,
  x: number,
  y: number,
  spec = PLANETS[Phaser.Math.Between(0, PLANETS.length - 1)],
): PlanetEntity {
  return {
    body: scene.add.circle(x, y, spec.radius, spec.color).setStrokeStyle(4, 0xffffff, 0.18),
    gravityStrength: spec.gravityStrength,
    radius: spec.radius,
  };
}

export function createSandboxPlanets(scene: Phaser.Scene, world: WorldSize, count: number): PlanetEntity[] {
  const planets: PlanetEntity[] = [];
  const margin = Math.max(...PLANETS.map((planet) => planet.radius)) * 2;
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
