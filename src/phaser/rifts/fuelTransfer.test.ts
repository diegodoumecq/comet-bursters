import { describe, expect, it } from 'vitest';

import { releaseExitedRiftFuelBlobs } from './fuelTransfer';
import type { RiftSourceSpace } from './types';

function createSourceSpace(): RiftSourceSpace {
  return {
    asteroids: [],
    fuelBlobs: [],
    id: 2,
    particles: [],
    player: null,
    portal: {
      angle: 0,
      apertureRadiusX: 100,
      apertureRadiusY: 60,
      closeDurationMs: 500,
      closeStartedAt: null,
      durationMs: 5000,
      id: 2,
      openDurationMs: 400,
      openedAt: 0,
      position: { x: 300, y: 200 },
      radiusX: 100,
      radiusY: 60,
      sourcePosition: { x: 700, y: 500 },
      state: 'active',
    },
    projectiles: [],
    size: { width: 1200, height: 900 },
    state: 'active',
    timedOutAt: null,
  };
}

describe('rift fuel transfer', () => {
  it('releases rift fuel blobs that clear the portal front', () => {
    const sourceSpace = createSourceSpace();
    const blob = {
      id: 1,
      membership: { portalId: 2 as const, space: 'rift' as const },
      position: { x: 700, y: 572 },
      velocity: { x: 5, y: 4 },
      wobbleSeed: 0,
    };
    sourceSpace.fuelBlobs.push(blob);

    const released = releaseExitedRiftFuelBlobs(sourceSpace);

    expect(released).toEqual([blob]);
    expect(sourceSpace.fuelBlobs).toEqual([]);
    expect(blob.membership).toEqual({ space: 'arcade' });
    expect(blob.position).toEqual({ x: 372, y: 200 });
    expect(blob.velocity).toEqual({ x: 4, y: 5 });
  });

  it('keeps rift fuel blobs that have not cleared the portal', () => {
    const sourceSpace = createSourceSpace();
    const blob = {
      id: 1,
      membership: { portalId: 2 as const, space: 'rift' as const },
      position: { x: 700, y: 540 },
      velocity: { x: 0, y: 4 },
      wobbleSeed: 0,
    };
    sourceSpace.fuelBlobs.push(blob);

    const released = releaseExitedRiftFuelBlobs(sourceSpace);

    expect(released).toEqual([]);
    expect(sourceSpace.fuelBlobs).toEqual([blob]);
    expect(blob.membership).toEqual({ portalId: 2, space: 'rift' });
  });
});
