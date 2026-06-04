import { describe, expect, it, vi } from 'vitest';

import type { FuelBlobEntity } from '../../fuel/types';
import { keepMovingEntitiesNearPlayer } from './worldPositioning';

describe('sandbox world positioning', () => {
  it('syncs fuel blobs from Matter before repositioning them near the player', () => {
    const blob: FuelBlobEntity = {
      id: 1,
      affectedByPlanetGravity: false,
      airResistance: 0.015,
      position: { x: 0, y: 0 },
      velocity: { x: 24, y: 0 },
      wobbleSeed: 0,
    };
    const fuelBodies = {
      setPosition: vi.fn((target: FuelBlobEntity, position: FuelBlobEntity['position']) => {
        target.position = { ...position };
      }),
      sync: vi.fn((target: FuelBlobEntity) => {
        target.position = { x: 124, y: 100 };
      }),
    };

    keepMovingEntitiesNearPlayer({
      asteroidBodies: { get: vi.fn() },
      fuelBodies,
      mothership: { keepNear: vi.fn(), sync: vi.fn() },
      now: 1000,
      particleViews: { sync: vi.fn() },
      planetViews: { sync: vi.fn() },
      planets: [],
      player: { position: { x: 100, y: 100 } },
      playerBody: {},
      projectileBodies: { setPosition: vi.fn() },
      runtime: { world: { asteroids: [], fuelBlobs: [blob], particles: [], projectiles: [] } },
      world: { height: 1000, width: 1000 },
    } as unknown as Parameters<typeof keepMovingEntitiesNearPlayer>[0]);

    expect(fuelBodies.sync).toHaveBeenCalledWith(blob);
    expect(fuelBodies.setPosition).toHaveBeenCalledWith(blob, { x: 124, y: 100 });
    expect(blob.position).toEqual({ x: 124, y: 100 });
  });
});
