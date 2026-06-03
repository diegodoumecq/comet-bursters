import Phaser from 'phaser';

import type { RandomSource } from '../core/random';
import { PLANET_SPECS } from './config';
import type { PlanetEntity, PlanetKind } from './types';

export { PLANET_SPECS } from './config';

const PLANET_KINDS = Object.keys(PLANET_SPECS) as PlanetKind[];
const PLANET_MIN_ROTATION_SPEED = 0.00002;
const PLANET_MAX_ROTATION_SPEED = 0.00008;

let nextPlanetId = 1;

export function createPlanet(
  x: number,
  y: number,
  spec = PLANET_SPECS[PLANET_KINDS[Phaser.Math.Between(0, PLANET_KINDS.length - 1)]],
  random: RandomSource = phaserRandom,
): PlanetEntity {
  const colorHex = spec.palette[random.between(0, spec.palette.length - 1)];
  const rotationDirection = random.float() < 0.5 ? -1 : 1;
  return {
    altitudeVariations: Array.from({ length: 32 }, () => 0.9 + random.float() * 0.2),
    color: hexToNumber(colorHex),
    colorHex,
    gravityStrength: spec.gravityStrength,
    id: nextPlanetId++,
    kind: spec.kind,
    position: { x, y },
    radius: spec.radius,
    rotation: random.float() * Math.PI * 2,
    rotationSpeed:
      rotationDirection *
      (PLANET_MIN_ROTATION_SPEED +
        random.float() * (PLANET_MAX_ROTATION_SPEED - PLANET_MIN_ROTATION_SPEED)),
  };
}

export function getFuelReserveForPlanet(
  planet: PlanetEntity,
  random: RandomSource = phaserRandom,
): number {
  const range = PLANET_SPECS[planet.kind].fuelReserveRange;
  return Math.floor((range.min + random.float() * (range.max - range.min)) / 5) * 5;
}

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

const phaserRandom: RandomSource = {
  between: (min, max) => Phaser.Math.Between(min, max),
  float: () => Math.random(),
  floatBetween: (min, max) => Phaser.Math.FloatBetween(min, max),
  pick: (items) => items[Phaser.Math.Between(0, items.length - 1)],
};
