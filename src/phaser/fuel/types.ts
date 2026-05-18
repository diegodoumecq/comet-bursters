import type { Vector } from '../core/types';

export type FuelBlobEntity = {
  id: number;
  position: Vector;
  velocity: Vector;
  wobbleSeed: number;
};
