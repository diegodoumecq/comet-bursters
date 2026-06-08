import { describe, expect, it } from 'vitest';

import type { FuelBlobEntity } from '../fuel/types';
import {
  createBlackHoleFromFuelExplosion,
  FUEL_BLOBS_PER_EXPLOSION_BLACK_HOLE,
} from './explosionBlackHoles';

describe('explosion black holes', () => {
  it('does not form a black hole below the fuel explosion threshold', () => {
    const blobs = createFuelBlobs(FUEL_BLOBS_PER_EXPLOSION_BLACK_HOLE - 1);

    expect(createBlackHoleFromFuelExplosion({ blobs, nextProjectileId: 10, now: 1000 })).toBeNull();
  });

  it('forms a black hole from a sufficiently large connected fuel explosion', () => {
    const blobs = createFuelBlobs(FUEL_BLOBS_PER_EXPLOSION_BLACK_HOLE);

    const blackHole = createBlackHoleFromFuelExplosion({
      blobs,
      nextProjectileId: 10,
      now: 1000,
    });

    expect(blackHole).toEqual(
      expect.objectContaining({
        blackHoleMass: 1,
        id: 10,
        kind: 'blackHole',
        position: { x: 35, y: 0 },
      }),
    );
  });

  it('scales black hole mass with larger fuel explosions', () => {
    const blobs = createFuelBlobs(FUEL_BLOBS_PER_EXPLOSION_BLACK_HOLE * 2);

    const blackHole = createBlackHoleFromFuelExplosion({
      blobs,
      nextProjectileId: 10,
      now: 1000,
    });

    expect(blackHole?.blackHoleMass).toBe(2);
  });
});

function createFuelBlobs(count: number): FuelBlobEntity[] {
  return Array.from({ length: count }, (_, index) => ({
    affectedByPlanetGravity: true,
    airResistance: 0.015,
    id: index + 1,
    position: { x: index * 10, y: 0 },
    velocity: { x: 1, y: 0 },
    wobbleSeed: 0,
  }));
}
