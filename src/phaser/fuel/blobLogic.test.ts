import { describe, expect, it, vi } from 'vitest';

import {
  getFuelBlobExplosionChain,
  spawnAsteroidFuelDrops,
  spawnFuelBlobs,
  spawnShipFuelDrops,
  updateFuelBlob,
  updateFuelBlobs,
} from './blobLogic';
import { FUEL_BLOB_AMOUNT, FUEL_BLOB_SPAWN_DRIFT_SPEED } from './definition';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Distance: {
        Between: (fromX: number, fromY: number, toX: number, toY: number) =>
          Math.hypot(toX - fromX, toY - fromY),
      },
      FloatBetween: (_min: number, max: number) => max,
    },
  },
}));

const world = { height: 600, width: 800 };

describe('fuel blob movement', () => {
  it('pulls strongly toward the player ship when collectable', () => {
    const blob = {
      id: 1,
      airResistance: 0.015,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };

    updateFuelBlob(blob, { x: 0, y: 0 }, true, 1 / 60, world);

    expect(blob.velocity.x).toBeLessThan(-0.015);
  });

  it('does not pull toward the player when collection is disabled', () => {
    const blob = {
      id: 1,
      airResistance: 0.015,
      position: { x: 100, y: 0 },
      velocity: { x: 0, y: 0 },
      wobbleSeed: 0,
    };

    updateFuelBlob(blob, { x: 0, y: 0 }, false, 1 / 60, world);

    expect(blob.velocity.x).toBe(0);
  });

  it('does not cap fired fuel blob speed', () => {
    const blob = {
      id: 1,
      airResistance: 0,
      gravityScale: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 24, y: 0 },
      wobbleSeed: 0,
    };

    updateFuelBlob(blob, { x: 0, y: 0 }, false, 1 / 60, world, false);

    expect(Math.hypot(blob.velocity.x, blob.velocity.y)).toBeCloseTo(24);
  });

  it('uses scaled player collision radius for collection', () => {
    const blobs = [
      {
        id: 1,
        airResistance: 0.015,
        position: { x: 35, y: 0 },
        velocity: { x: 0, y: 0 },
        wobbleSeed: 0,
      },
    ];

    const normal = updateFuelBlobs(
      blobs.map((blob) => ({
        ...blob,
        position: { ...blob.position },
        velocity: { ...blob.velocity },
      })),
      { x: 0, y: 0 },
      true,
      0,
      world,
      false,
    );
    const scaled = updateFuelBlobs(blobs, { x: 0, y: 0 }, true, 0, world, false, 36);

    expect(normal.collected).toHaveLength(0);
    expect(scaled.collected).toHaveLength(1);
  });

  it('spawns settled fuel drops without inheriting source explosion velocity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const blobs = spawnFuelBlobs({ x: 100, y: 200 }, 1);

    expect(Math.hypot(blobs[0].velocity.x, blobs[0].velocity.y)).toBe(FUEL_BLOB_SPAWN_DRIFT_SPEED);
  });

  it('does not launch asteroid fuel drops with asteroid velocity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const blobs = spawnAsteroidFuelDrops({
      angularVelocity: 0,
      id: 1,
      position: { x: 100, y: 200 },
      rotation: 0,
      tier: 'mega',
      velocity: { x: 500, y: 0 },
      visualVariant: 0,
    });

    expect(blobs[0].velocity.x).toBe(FUEL_BLOB_SPAWN_DRIFT_SPEED);
  });

  it('spawns ship fuel drops with the ship velocity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const blobs = spawnShipFuelDrops({ x: 100, y: 200 }, { x: 120, y: -40 }, FUEL_BLOB_AMOUNT * 2);

    expect(blobs[0].velocity).toEqual({
      x: 120 + FUEL_BLOB_SPAWN_DRIFT_SPEED,
      y: -40,
    });
  });

  it('spawns one fuel blob for each full fuel blob amount in half the ship fuel', () => {
    const blobs = spawnShipFuelDrops({ x: 100, y: 200 }, { x: 0, y: 0 }, FUEL_BLOB_AMOUNT * 6);

    expect(blobs).toHaveLength(3);
  });

  it('does not spawn ship fuel drops when half the ship fuel is below one blob amount', () => {
    const blobs = spawnShipFuelDrops({ x: 100, y: 200 }, { x: 0, y: 0 }, FUEL_BLOB_AMOUNT * 2 - 1);

    expect(blobs).toHaveLength(0);
  });
});

describe('fuel blob chain reactions', () => {
  it('walks nearby fuel blobs through the reaction radius', () => {
    const blobs = [fuelBlob(1, 0), fuelBlob(2, 90), fuelBlob(3, 180), fuelBlob(4, 300)];

    const exploded = getFuelBlobExplosionChain({ blobs, origin: blobs[0], radius: 92 });

    expect(exploded.map((blob) => blob.id)).toEqual([1, 2, 3]);
  });
});

function fuelBlob(id: number, x: number) {
  return {
    id,
    airResistance: 0.015,
    position: { x, y: 0 },
    velocity: { x: 0, y: 0 },
    wobbleSeed: 0,
  };
}
