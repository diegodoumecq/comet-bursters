import { describe, expect, it } from 'vitest';

import { disposeRiftSourceSpaceTransientState } from './closureRules';
import type { RiftSourceSpace } from './types';

function createSourceSpace(): RiftSourceSpace {
  return {
    asteroids: [],
    fuelBlobs: [
      {
        id: 1,
        membership: { portalId: 2, space: 'rift' },
        position: { x: 1, y: 2 },
        velocity: { x: 3, y: 4 },
        wobbleSeed: 0,
      },
    ],
    id: 2,
    particles: [
      {
        alphaDecayPerSecond: 1,
        color: 0xffffff,
        dragPerSecond: 0,
        id: 1,
        kind: 'circle',
        lifetimeMs: 100,
        maxLifetimeMs: 100,
        membership: { portalId: 2, space: 'rift' },
        position: { x: 1, y: 2 },
        radius: 2,
        rotation: 0,
        velocity: { x: 3, y: 4 },
      },
    ],
    player: null,
    projectiles: [
      {
        absorbedFuel: 0,
        ageMs: 0,
        angle: 0,
        collapseStartedAt: null,
        createdAt: 0,
        id: 1,
        kind: 'small',
        lifetimeMs: 1000,
        membership: { portalId: 2, space: 'rift' },
        position: { x: 1, y: 2 },
        velocity: { x: 3, y: 4 },
      },
    ],
    portal: {
      angle: 0,
      apertureRadiusX: 100,
      apertureRadiusY: 60,
      closeDurationMs: 500,
      closeStartedAt: 1000,
      durationMs: 5000,
      id: 2,
      openDurationMs: 400,
      openedAt: 0,
      position: { x: 300, y: 200 },
      radiusX: 100,
      radiusY: 60,
      sourcePosition: { x: 700, y: 500 },
      state: 'disposed',
    },
    size: { width: 1200, height: 900 },
    state: 'disposed',
    timedOutAt: 5000,
  };
}

describe('rift closure rules', () => {
  it('expires transient rift-owned fuel and particles when a source space is disposed', () => {
    const sourceSpace = createSourceSpace();

    const result = disposeRiftSourceSpaceTransientState(sourceSpace);

    expect(result).toEqual({ removedFuelBlobs: 1, removedParticles: 1, removedProjectiles: 1 });
    expect(sourceSpace.fuelBlobs).toEqual([]);
    expect(sourceSpace.particles).toEqual([]);
    expect(sourceSpace.projectiles).toEqual([]);
  });
});
