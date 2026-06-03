import type { PlanetEntity, PlanetKind } from './types';

export type PlanetSpec = {
  fuelReserveRange: { max: number; min: number };
  gravityStrength: number;
  kind: PlanetKind;
  palette: string[];
  radius: PlanetEntity['radius'];
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
