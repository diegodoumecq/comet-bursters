import type { Vector } from '../core/types';
import type { FuelBlobEntity } from './types';

let nextFuelBlobId = 1;
const DEFAULT_FUEL_BLOB_AIR_RESISTANCE = 0.015;

export function createFuelBlob(
  position: Vector,
  velocity: Vector,
  properties: Partial<
    Pick<FuelBlobEntity, 'affectedByPlanetGravity' | 'airResistance' | 'collectableAtMs'>
  > = {},
): FuelBlobEntity {
  const blob: FuelBlobEntity = {
    affectedByPlanetGravity: properties.affectedByPlanetGravity ?? true,
    airResistance: properties.airResistance ?? DEFAULT_FUEL_BLOB_AIR_RESISTANCE,
    id: nextFuelBlobId++,
    position: { ...position },
    velocity: { ...velocity },
    wobbleSeed: Math.random(),
  };
  if (properties.collectableAtMs !== undefined) blob.collectableAtMs = properties.collectableAtMs;
  return blob;
}
