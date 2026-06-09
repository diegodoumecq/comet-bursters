import type { Vector } from '../core/types';
import { FUEL_BLOB_DEFINITION } from './definition';
import type { FuelBlobEntity } from './types';

let nextFuelBlobId = 1;

export function createFuelBlob(
  position: Vector,
  velocity: Vector,
  properties: Partial<
    Pick<FuelBlobEntity, 'airResistance' | 'collectableAtMs' | 'gravityScale'>
  > = {},
): FuelBlobEntity {
  const blob: FuelBlobEntity = {
    airResistance: properties.airResistance ?? FUEL_BLOB_DEFINITION.spawn.defaultAirResistance,
    id: nextFuelBlobId++,
    position: { ...position },
    velocity: { ...velocity },
    wobbleSeed: Math.random(),
  };
  if (properties.collectableAtMs !== undefined) blob.collectableAtMs = properties.collectableAtMs;
  if (properties.gravityScale !== undefined) blob.gravityScale = properties.gravityScale;
  return blob;
}
