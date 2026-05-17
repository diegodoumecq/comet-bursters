import Phaser from 'phaser';

import type { PlanetEntity } from '../model';

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
