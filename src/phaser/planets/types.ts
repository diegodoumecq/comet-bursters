import type { Vector } from '../core/types';

export type PlanetEntity = {
  color: number;
  gravityStrength: number;
  id: number;
  position: Vector;
  radius: number;
};
