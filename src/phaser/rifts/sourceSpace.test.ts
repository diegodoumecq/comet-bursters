import { describe, expect, it, vi } from 'vitest';

import { ASTEROIDS } from '../asteroids/logic';
import {
  RIFT_CLOSE_DURATION_MS,
  RIFT_DEEP_INSIDE_CULL_MARGIN,
  RIFT_DURATION_MS,
  RIFT_OPEN_DURATION_MS,
  RIFT_PORTAL_RADIUS_X,
  RIFT_PORTAL_RADIUS_Y,
  RIFT_SOURCE_HEIGHT,
  RIFT_SOURCE_WIDTH,
  RIFT_TIMEOUT_DRAIN_GRACE_MS,
} from './config';
import { getRiftSourceLocalPosition, projectRiftLocalVectorToScene } from './geometry';
import {
  createRiftBurst,
  getRiftProjections,
  syncRiftLifecycle,
  updateRiftSourceAsteroids,
  updateRiftSourceSpace,
} from './sourceSpace';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Between: (() => {
        let calls = 0;
        return (min: number, max: number) => {
          calls += 1;
          const progress = ((calls * 997) % 1000) / 999;
          return Math.floor(min + (max - min) * progress);
        };
      })(),
      Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
      FloatBetween: (min: number, max: number) => (min + max) * 0.5,
    },
  },
}));

const world = { width: 900, height: 700 };

describe('rift source space', () => {
  it('creates one fixed portal and stages asteroids inside source space', () => {
    const burst = createRiftBurst({
      asteroidCount: 7,
      burstIndex: 3,
      exclusions: [],
      now: 1200,
      world,
    });

    expect(burst.portal.openedAt).toBe(1200);
    expect(burst.portal.radiusX).toBe(RIFT_PORTAL_RADIUS_X);
    expect(burst.portal.radiusY).toBe(RIFT_PORTAL_RADIUS_Y);
    expect(burst.sourceSpace.size).toEqual({
      width: RIFT_SOURCE_WIDTH,
      height: RIFT_SOURCE_HEIGHT,
    });
    expect(burst.sourceSpace.asteroids).toHaveLength(7);
    for (const sourceAsteroid of burst.sourceSpace.asteroids) {
      expect(sourceAsteroid.sourcePosition.x).toBeGreaterThanOrEqual(0);
      expect(sourceAsteroid.sourcePosition.x).toBeLessThanOrEqual(RIFT_SOURCE_WIDTH);
      expect(sourceAsteroid.sourcePosition.y).toBeGreaterThanOrEqual(0);
      expect(sourceAsteroid.sourcePosition.y).toBeLessThanOrEqual(RIFT_SOURCE_HEIGHT);
      const localPosition = getRiftSourceLocalPosition(burst.portal, sourceAsteroid.sourcePosition);
      expect(localPosition.y).toBeLessThan(-burst.portal.radiusY);
    }
  });

  it('projects source asteroids into scene space and activates only after full emergence', () => {
    const burst = createRiftBurst({
      asteroidCount: 1,
      burstIndex: 1,
      exclusions: [],
      now: 0,
      world,
    });
    const sourceAsteroid = burst.sourceSpace.asteroids[0];
    sourceAsteroid.sourcePosition.x = burst.portal.sourcePosition.x;
    sourceAsteroid.sourcePosition.y =
      burst.portal.sourcePosition.y +
      burst.portal.radiusY +
      ASTEROIDS[sourceAsteroid.asteroid.tier].radius;

    let projection = getRiftProjections(burst.sourceSpace.asteroids, burst.portal)[0];
    expect(projection.status).toBe('crossing');

    sourceAsteroid.sourcePosition.y += 1;
    projection = getRiftProjections(burst.sourceSpace.asteroids, burst.portal)[0];
    expect(projection.status).toBe('emerged');
  });

  it('uses the oval portal boundary when deciding emergence', () => {
    const burst = createRiftBurst({
      asteroidCount: 1,
      burstIndex: 1,
      exclusions: [],
      now: 0,
      world,
    });
    const sourceAsteroid = burst.sourceSpace.asteroids[0];
    const radius = ASTEROIDS[sourceAsteroid.asteroid.tier].radius;
    const localX = burst.portal.radiusX * 0.9;
    const boundaryAtX = burst.portal.radiusY * Math.sqrt(1 - 0.9 * 0.9);
    sourceAsteroid.sourcePosition.x = burst.portal.sourcePosition.x + localX;
    sourceAsteroid.sourcePosition.y = burst.portal.sourcePosition.y + boundaryAtX + radius;

    let projection = getRiftProjections(burst.sourceSpace.asteroids, burst.portal)[0];
    expect(projection.status).toBe('crossing');

    sourceAsteroid.sourcePosition.y += 1;
    projection = getRiftProjections(burst.sourceSpace.asteroids, burst.portal)[0];
    expect(projection.status).toBe('emerged');
  });

  it('updates local movement before scene-space velocity conversion', () => {
    const burst = createRiftBurst({
      asteroidCount: 1,
      burstIndex: 1,
      exclusions: [],
      now: 0,
      world,
    });
    const sourceAsteroid = burst.sourceSpace.asteroids[0];
    sourceAsteroid.asteroid.velocity = { x: 10, y: 20 };
    const start = { ...sourceAsteroid.sourcePosition };

    updateRiftSourceAsteroids({
      deltaSeconds: 0.5,
      sourceAsteroids: burst.sourceSpace.asteroids,
    });

    expect(sourceAsteroid.sourcePosition.x).toBe(start.x + 300);
    const sceneVelocity = projectRiftLocalVectorToScene(
      burst.portal,
      sourceAsteroid.asteroid.velocity,
    );
    expect(Math.hypot(sceneVelocity.x, sceneVelocity.y)).toBeCloseTo(Math.hypot(10, 20));
  });

  it('does not move source asteroids before the portal is visible', () => {
    const burst = createRiftBurst({
      asteroidCount: 1,
      burstIndex: 1,
      exclusions: [],
      now: 1000,
      world,
    });
    const sourceAsteroid = burst.sourceSpace.asteroids[0];
    const start = { ...sourceAsteroid.sourcePosition };

    updateRiftSourceSpace({
      deltaSeconds: 1,
      now: 1000 + RIFT_OPEN_DURATION_MS * 0.5,
      sourceSpace: burst.sourceSpace,
    });

    expect(sourceAsteroid.sourcePosition).toEqual(start);

    updateRiftSourceSpace({
      deltaSeconds: 1,
      now: 1000 + RIFT_OPEN_DURATION_MS,
      sourceSpace: burst.sourceSpace,
    });

    expect(sourceAsteroid.sourcePosition.y).toBeGreaterThan(start.y);
  });

  it('keeps a portal alive before timeout until source asteroids are resolved', () => {
    const burst = createRiftBurst({
      asteroidCount: 1,
      burstIndex: 1,
      exclusions: [],
      now: 0,
      world,
    });

    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS - 1);

    expect(burst.sourceSpace.state).not.toBe('disposed');
    expect(burst.portal.closeStartedAt).toBeNull();

    burst.sourceSpace.asteroids.length = 0;
    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS);

    expect(burst.sourceSpace.state).toBe('closing');
    expect(burst.portal.closeStartedAt).toBe(RIFT_DURATION_MS);

    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS + RIFT_CLOSE_DURATION_MS);

    expect(burst.sourceSpace.state).toBe('disposed');
  });

  it('closes on timeout and deletes source leftovers that never reached the portal', () => {
    const burst = createRiftBurst({
      asteroidCount: 2,
      burstIndex: 1,
      exclusions: [],
      now: 0,
      world,
    });
    for (const sourceAsteroid of burst.sourceSpace.asteroids) {
      const radius = ASTEROIDS[sourceAsteroid.asteroid.tier].radius;
      sourceAsteroid.sourcePosition.x = burst.portal.sourcePosition.x;
      sourceAsteroid.sourcePosition.y =
        burst.portal.sourcePosition.y -
        burst.portal.radiusY -
        radius -
        RIFT_DEEP_INSIDE_CULL_MARGIN -
        1;
    }

    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS);

    expect(burst.sourceSpace.state).toBe('closing');
    expect(burst.sourceSpace.asteroids).toHaveLength(0);
  });

  it('keeps timed-out crossing asteroids alive so they can emerge', () => {
    const burst = createRiftBurst({
      asteroidCount: 1,
      burstIndex: 1,
      exclusions: [],
      now: 0,
      world,
    });
    const sourceAsteroid = burst.sourceSpace.asteroids[0];
    sourceAsteroid.sourcePosition.y = burst.portal.sourcePosition.y - burst.portal.radiusY + 1;

    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS);

    expect(burst.sourceSpace.state).toBe('draining');
    expect(burst.portal.closeStartedAt).toBeNull();
    expect(burst.sourceSpace.asteroids).toHaveLength(1);
  });

  it('keeps timed-out visible asteroids alive after the drain grace period', () => {
    const burst = createRiftBurst({
      asteroidCount: 1,
      burstIndex: 1,
      exclusions: [],
      now: 0,
      world,
    });
    const sourceAsteroid = burst.sourceSpace.asteroids[0];
    sourceAsteroid.sourcePosition.y = burst.portal.sourcePosition.y - burst.portal.radiusY + 1;

    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS);
    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS + RIFT_TIMEOUT_DRAIN_GRACE_MS);

    expect(burst.sourceSpace.state).toBe('draining');
    expect(burst.portal.closeStartedAt).toBeNull();
    expect(burst.sourceSpace.asteroids).toHaveLength(1);
  });

  it('removes stranded non-visible timed-out asteroids after the drain grace period', () => {
    const burst = createRiftBurst({
      asteroidCount: 1,
      burstIndex: 1,
      exclusions: [],
      now: 0,
      world,
    });
    const sourceAsteroid = burst.sourceSpace.asteroids[0];
    sourceAsteroid.sourcePosition.x = burst.portal.sourcePosition.x + burst.portal.radiusX * 3;
    sourceAsteroid.sourcePosition.y = burst.portal.sourcePosition.y;

    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS);
    syncRiftLifecycle(burst.sourceSpace, RIFT_DURATION_MS + RIFT_TIMEOUT_DRAIN_GRACE_MS);

    expect(burst.sourceSpace.state).toBe('closing');
    expect(burst.sourceSpace.asteroids).toHaveLength(0);
  });
});
