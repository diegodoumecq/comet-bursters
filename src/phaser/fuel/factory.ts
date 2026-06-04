import type { Vector } from '../core/types';
import { FUEL_BLOB_DEFINITION } from './definition';
import type { FuelBlobEntity } from './types';

let nextFuelBlobId = 1;

export function createFuelBlob(
  position: Vector,
  velocity: Vector,
  properties: Partial<
    Pick<FuelBlobEntity, 'affectedByPlanetGravity' | 'airResistance' | 'collectableAtMs'>
  > = {},
): FuelBlobEntity {
  const blob: FuelBlobEntity = {
    affectedByPlanetGravity: properties.affectedByPlanetGravity ?? true,
    airResistance: properties.airResistance ?? FUEL_BLOB_DEFINITION.spawn.defaultAirResistance,
    id: nextFuelBlobId++,
    position: { ...position },
    velocity: { ...velocity },
    wobbleSeed: Math.random(),
  };
  if (properties.collectableAtMs !== undefined) blob.collectableAtMs = properties.collectableAtMs;
  return blob;
}
