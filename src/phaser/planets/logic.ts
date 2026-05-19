import Phaser from 'phaser';

import type { PlanetEntity, PlanetKind } from './types';

type PlanetSpec = {
  fuelReserveRange: { max: number; min: number };
  gravityStrength: number;
  kind: PlanetKind;
  palette: string[];
  radius: number;
};

export const PLANET_SPECS: Record<PlanetKind, PlanetSpec> = {
  lush: {
    fuelReserveRange: { min: 1500, max: 3000 },
    gravityStrength: 0.5,
    kind: 'lush',
    palette: ['#2ecc71', '#27ae60', '#58d68d'],
    radius: 250,
  },
  desert: {
    fuelReserveRange: { min: 0, max: 0 },
    gravityStrength: 0.5,
    kind: 'desert',
    palette: ['#f39c12', '#d68910', '#e67e22'],
    radius: 250,
  },
  ice: {
    fuelReserveRange: { min: 0, max: 50 },
    gravityStrength: 0.5,
    kind: 'ice',
    palette: ['#8bd3ff', '#5dade2', '#d6f6ff'],
    radius: 250,
  },
  lava: {
    fuelReserveRange: { min: 0, max: 50 },
    gravityStrength: 0.5,
    kind: 'lava',
    palette: ['#e74c3c', '#ff6b35', '#c0392b'],
    radius: 450,
  },
  gas: {
    fuelReserveRange: { min: 0, max: 50 },
    gravityStrength: 0.5,
    kind: 'gas',
    palette: ['#9b59b6', '#8e44ad', '#c39bd3'],
    radius: 700,
  },
  toxic: {
    fuelReserveRange: { min: 0, max: 50 },
    gravityStrength: 0.5,
    kind: 'toxic',
    palette: ['#1abc9c', '#16a085', '#7bed9f'],
    radius: 350,
  },
  crystal: {
    fuelReserveRange: { min: 0, max: 50 },
    gravityStrength: 1,
    kind: 'crystal',
    palette: ['#8ef6ff', '#7bc7ff', '#d6f7ff'],
    radius: 300,
  },
};

const PLANET_KINDS = Object.keys(PLANET_SPECS) as PlanetKind[];
const PLANET_MIN_ROTATION_SPEED = 0.00002;
const PLANET_MAX_ROTATION_SPEED = 0.00008;

let nextPlanetId = 1;

export function createPlanet(
  x: number,
  y: number,
  spec = PLANET_SPECS[PLANET_KINDS[Phaser.Math.Between(0, PLANET_KINDS.length - 1)]],
): PlanetEntity {
  const colorHex = spec.palette[Phaser.Math.Between(0, spec.palette.length - 1)];
  const rotationDirection = Math.random() < 0.5 ? -1 : 1;
  return {
    altitudeVariations: Array.from({ length: 32 }, () => 0.9 + Math.random() * 0.2),
    color: hexToNumber(colorHex),
    colorHex,
    gravityStrength: spec.gravityStrength,
    id: nextPlanetId++,
    kind: spec.kind,
    position: { x, y },
    radius: spec.radius,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed:
      rotationDirection *
      (PLANET_MIN_ROTATION_SPEED +
        Math.random() * (PLANET_MAX_ROTATION_SPEED - PLANET_MIN_ROTATION_SPEED)),
  };
}

export function getFuelReserveForPlanet(planet: PlanetEntity): number {
  const range = PLANET_SPECS[planet.kind].fuelReserveRange;
  return Math.floor((range.min + Math.random() * (range.max - range.min)) / 5) * 5;
}

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}
