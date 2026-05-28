import { describe, expect, it } from 'vitest';

import { releaseExitedRiftParticles } from './particleTransfer';
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

describe('rift particle transfer', () => {
  it('releases particles that clear the portal front', () => {
    const sourceSpace = createSourceSpace();
    const particle = {
      alphaDecayPerSecond: 1,
      color: 0xffffff,
      dragPerSecond: 0,
      id: 1,
      kind: 'circle' as const,
      lifetimeMs: 100,
      maxLifetimeMs: 100,
      membership: { portalId: 2 as const, space: 'rift' as const },
      position: { x: 700, y: 563 },
      radius: 2,
      rotation: 0,
      velocity: { x: 5, y: 4 },
    };
    sourceSpace.particles.push(particle);

    const released = releaseExitedRiftParticles(sourceSpace);

    expect(released).toEqual([particle]);
    expect(sourceSpace.particles).toEqual([]);
    expect(particle.membership).toEqual({ space: 'arcade' });
    expect(particle.position).toEqual({ x: 363, y: 200 });
    expect(particle.velocity).toEqual({ x: 4, y: 5 });
  });

  it('keeps particles that have not cleared the portal', () => {
    const sourceSpace = createSourceSpace();
    const particle = {
      alphaDecayPerSecond: 1,
      color: 0xffffff,
      dragPerSecond: 0,
      id: 1,
      kind: 'circle' as const,
      lifetimeMs: 100,
      maxLifetimeMs: 100,
      membership: { portalId: 2 as const, space: 'rift' as const },
      position: { x: 700, y: 540 },
      radius: 2,
      rotation: 0,
      velocity: { x: 0, y: 4 },
    };
    sourceSpace.particles.push(particle);

    const released = releaseExitedRiftParticles(sourceSpace);

    expect(released).toEqual([]);
    expect(sourceSpace.particles).toEqual([particle]);
    expect(particle.membership).toEqual({ portalId: 2, space: 'rift' });
  });
});
