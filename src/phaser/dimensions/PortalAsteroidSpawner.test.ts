import { describe, expect, it, vi } from 'vitest';

import { createPortalAsteroidSpawn } from './PortalAsteroidSpawner';
import type { PortalDirectorPlan } from './types';

describe('createPortalAsteroidSpawn', () => {
  it('spawns asteroids behind the portal and aims them at the portal crossing direction', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const plan = createPlan();
    const asteroids = createPortalAsteroidSpawn({ burstIndex: 1, plan });

    expect(asteroids).toHaveLength(3);
    for (const asteroid of asteroids) {
      expect(asteroid.membership).toEqual({ space: 'rift' });
      expect(asteroid.position.x).toBeLessThan(plan.portal.position.x);
      expect(asteroid.velocity.x).toBeGreaterThan(0);
      expect(asteroid.velocity.y).toBe(0);
    }
  });
});

function createPlan(): PortalDirectorPlan {
  return {
    portal: {
      activeDurationMs: 1000,
      aperture: { radiusX: 100, radiusY: 60 },
      closeStartedAt: null,
      closingDurationMs: 200,
      id: 1,
      lifecycle: 'active',
      normal: { x: 1, y: 0 },
      openedAt: 0,
      openingDurationMs: 200,
      position: { x: 300, y: 200 },
      viewPolicy: 'window',
      visualRadiusX: 120,
      visualRadiusY: 80,
    },
    spawn: {
      asteroidCount: 3,
      asteroidSpeed: 5,
      spawnDistance: 360,
      spreadRadius: 30,
    },
  };
}
