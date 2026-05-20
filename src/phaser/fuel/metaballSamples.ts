import type { Vector } from '../core/types';
import type { FuelMetaball } from './metaballs';
import { FUEL_BLOB_RADIUS } from './rules';
import type { FuelBlobEntity } from './types';

export type ScreenProjector = (position: Vector, radius: number) => Vector[];

type FuelBlobMetaballSampleInput = {
  blobs: FuelBlobEntity[];
  now: number;
  project: ScreenProjector;
};

export function buildFuelBlobMetaballSamples({
  blobs,
  now,
  project,
}: FuelBlobMetaballSampleInput): FuelMetaball[] {
  const metaballs: FuelMetaball[] = [];
  for (const blob of blobs) {
    const wobble = Math.sin(now * 0.004 + blob.wobbleSeed * Math.PI * 2) * 3;
    addProjectedMetaballs(
      metaballs,
      project,
      { x: blob.position.x, y: blob.position.y + wobble },
      FUEL_BLOB_RADIUS,
      blob.wobbleSeed,
    );
  }
  return metaballs;
}

export function addProjectedMetaballs(
  metaballs: FuelMetaball[],
  project: ScreenProjector,
  position: Vector,
  radius: number,
  seed: number,
): void {
  for (const screenPosition of project(position, radius * 3)) {
    metaballs.push({
      x: screenPosition.x,
      y: screenPosition.y,
      radius,
      seed,
    });
  }
}
