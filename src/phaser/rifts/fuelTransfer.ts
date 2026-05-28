import { FUEL_BLOB_RADIUS } from '../fuel/rules';
import type { FuelBlobEntity } from '../fuel/types';
import { getPortalTransferDecision } from './portalTransfer';
import type { RiftSourceSpace } from './types';

export function releaseExitedRiftFuelBlobs(sourceSpace: RiftSourceSpace): FuelBlobEntity[] {
  const released: FuelBlobEntity[] = [];
  for (let index = sourceSpace.fuelBlobs.length - 1; index >= 0; index -= 1) {
    const blob = sourceSpace.fuelBlobs[index];
    const decision = getPortalTransferDecision(
      {
        membership: blob.membership ?? { portalId: sourceSpace.portal.id, space: 'rift' },
        position: blob.position,
        radius: FUEL_BLOB_RADIUS,
        velocity: blob.velocity,
      },
      sourceSpace.portal,
    );
    if (decision?.space === 'arcade') {
      blob.membership = decision.membership;
      blob.position = decision.position;
      blob.velocity = decision.velocity;
      sourceSpace.fuelBlobs.splice(index, 1);
      released.push(blob);
    }
  }
  return released;
}
