import type { Vector } from '../core/types';
import type { FuelBlobEntity } from './types';

let nextFuelBlobId = 1;

export function createFuelBlob(position: Vector, velocity: Vector): FuelBlobEntity {
  return {
    id: nextFuelBlobId++,
    position: { ...position },
    velocity: { ...velocity },
    wobbleSeed: Math.random(),
  };
}
