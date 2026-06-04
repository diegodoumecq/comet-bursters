import type { Vector, WorldSize } from '../core/types';
import type { FuelBodies } from '../fuel/bodies';
import { isFuelBlobCollectable } from '../fuel/blobLogic';
import { FUEL_BLOB_AMOUNT } from '../fuel/rules';
import type { FuelBlobEntity } from '../fuel/types';
import type { MatterContacts } from './matterContacts';

export function updateFuelBlobCollection(input: {
  blobs: FuelBlobEntity[];
  canCollect: boolean;
  contacts: MatterContacts;
  deltaSeconds: number;
  fuelBodies: FuelBodies;
  now: number;
  player: Vector;
  world: WorldSize;
  wrap?: boolean;
}): { collected: FuelBlobEntity[]; fuelGain: number } {
  for (const blob of input.blobs) {
    input.fuelBodies.updateBlob({
      attractsToPlayer: input.canCollect && isFuelBlobCollectable(blob, input.now),
      blob,
      deltaSeconds: input.deltaSeconds,
      player: input.player,
      world: input.world,
      wrap: input.wrap,
    });
  }
  const contactedFuelBlobs = input.contacts
    .consumePlayerFuelBlobs()
    .filter((blob) => input.blobs.includes(blob));
  const collected = input.canCollect
    ? contactedFuelBlobs.filter((blob) => isFuelBlobCollectable(blob, input.now))
    : [];
  return { collected, fuelGain: collected.length * FUEL_BLOB_AMOUNT };
}
