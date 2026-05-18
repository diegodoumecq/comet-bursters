import Phaser from 'phaser';

import type { PlanetEntity } from './types';

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

let nextPlanetId = 1;

export function createPlanet(
  x: number,
  y: number,
  spec = PLANETS[Phaser.Math.Between(0, PLANETS.length - 1)],
): PlanetEntity {
  return {
    color: spec.color,
    gravityStrength: spec.gravityStrength,
    id: nextPlanetId++,
    position: { x, y },
    radius: spec.radius,
  };
}
