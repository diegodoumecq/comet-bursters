import type { RiftSourceSpace } from './types';

export type RiftClosureResult = {
  removedFuelBlobs: number;
  removedParticles: number;
  removedProjectiles: number;
};

export function disposeRiftSourceSpaceTransientState(
  sourceSpace: RiftSourceSpace,
): RiftClosureResult {
  const result = {
    removedFuelBlobs: sourceSpace.fuelBlobs.length,
    removedParticles: sourceSpace.particles.length,
    removedProjectiles: sourceSpace.projectiles.length,
  };
  sourceSpace.fuelBlobs.length = 0;
  sourceSpace.particles.length = 0;
  sourceSpace.projectiles.length = 0;
  return result;
}
