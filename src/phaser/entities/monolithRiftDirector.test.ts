import { describe, expect, it, vi } from 'vitest';

import {
  dotVector,
  portalApertureContainsCenter,
  subtractVector,
} from '../dimensions/portalGeometry';
import type { PortalEntity } from '../dimensions/types';
import { MonolithRiftDirector } from './monolithRiftDirector';
import type { GameEntity } from './types';

describe('MonolithRiftDirector', () => {
  it('creates a border-safe portal attack after the monolith prepares', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const director = new MonolithRiftDirector();
    const monolith = createMonolith({ x: 400, y: 300 });
    director.update({
      activePortal: null,
      forcedViewPolicy: 'window',
      monolith,
      now: 100,
      playerPosition: { x: 40, y: 40 },
      portalId: 7,
      world: { width: 1000, height: 800 },
    });

    const result = director.update({
      activePortal: null,
      monolith,
      now: 2800,
      playerPosition: { x: 40, y: 40 },
      portalId: 7,
      world: { width: 1000, height: 800 },
    });

    expect(result.attack?.portal.id).toBe(7);
    expect(result.attack?.portal.viewPolicy).toBe('window');
    expect(result.attack?.portal.position.x).toBeGreaterThan(260);
    expect(result.attack?.portal.position.x).toBeLessThan(740);
    expect(result.attack?.seedBalls.length).toBeGreaterThan(0);
  });

  it('does not create another attack while a portal is active', () => {
    const director = new MonolithRiftDirector();
    const result = director.update({
      activePortal: createPortal(),
      forcedViewPolicy: 'cameraTransfer',
      monolith: createMonolith({ x: 400, y: 300 }),
      now: 100,
      playerPosition: { x: 40, y: 40 },
      portalId: 8,
      world: { width: 1000, height: 800 },
    });

    expect(result.attack).toBeNull();
  });

  it('emits asteroid launches only for the active portal they were scheduled for', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const director = new MonolithRiftDirector();
    const monolith = createMonolith({ x: 400, y: 300 });
    director.update({
      activePortal: null,
      forcedViewPolicy: 'window',
      monolith,
      now: 100,
      playerPosition: { x: 40, y: 40 },
      portalId: 9,
      world: { width: 1000, height: 800 },
    });
    const attack = director.update({
      activePortal: null,
      monolith,
      now: 2800,
      playerPosition: { x: 40, y: 40 },
      portalId: 9,
      world: { width: 1000, height: 800 },
    }).attack;

    expect(attack).not.toBeNull();
    const wrongPortalLaunches = director.consumeDueAsteroidLaunches({
      monolithPosition: monolith.position,
      now: 4000,
      portal: createPortal(10),
    });
    const launches = director.consumeDueAsteroidLaunches({
      monolithPosition: monolith.position,
      now: 4000,
      portal: attack?.portal ?? null,
    });

    expect(wrongPortalLaunches).toHaveLength(0);
    expect(launches.length).toBeGreaterThan(0);
    expect(launches[0].velocity.x).toBeGreaterThan(0);
    for (const launch of launches) {
      const intersection = getPortalPlaneIntersection(
        launch.position,
        launch.velocity,
        attack?.portal ?? null,
      );
      expect(intersection).not.toBeNull();
      expect(
        intersection !== null &&
          portalApertureContainsCenter(attack?.portal ?? createPortal(), intersection),
      ).toBe(true);
    }
  });

  it('keeps scheduled asteroid launches while the newly created portal is not active yet', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const director = new MonolithRiftDirector();
    const monolith = createMonolith({ x: 400, y: 300 });
    director.update({
      activePortal: null,
      forcedViewPolicy: 'window',
      monolith,
      now: 100,
      playerPosition: { x: 40, y: 40 },
      portalId: 11,
      world: { width: 1000, height: 800 },
    });
    const attack = director.update({
      activePortal: null,
      monolith,
      now: 2800,
      playerPosition: { x: 40, y: 40 },
      portalId: 11,
      world: { width: 1000, height: 800 },
    }).attack;

    const prematureLaunches = director.consumeDueAsteroidLaunches({
      monolithPosition: monolith.position,
      now: 4000,
      portal: null,
    });
    const activePortalLaunches = director.consumeDueAsteroidLaunches({
      monolithPosition: monolith.position,
      now: 4000,
      portal: attack?.portal ?? null,
    });

    expect(prematureLaunches).toHaveLength(0);
    expect(activePortalLaunches.length).toBeGreaterThan(0);
  });

  it('starts preparing another attack before the timer when arcade pressure forces it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const director = new MonolithRiftDirector();
    const monolith = createMonolith({ x: 400, y: 300 });
    director.update({
      activePortal: null,
      forcePortal: true,
      monolith,
      now: 100,
      playerPosition: { x: 40, y: 40 },
      portalId: 12,
      world: { width: 1000, height: 800 },
    });
    monolith.position = director.update({
      activePortal: null,
      monolith,
      now: 200,
      playerPosition: { x: 40, y: 40 },
      portalId: 12,
      world: { width: 1000, height: 800 },
    }).movementTarget;
    const firstAttack = director.update({
      activePortal: null,
      monolith,
      now: 300,
      playerPosition: { x: 40, y: 40 },
      portalId: 12,
      world: { width: 1000, height: 800 },
    }).attack;

    expect(firstAttack).not.toBeNull();

    const forcedPreparation = director.update({
      activePortal: null,
      forcePortal: true,
      monolith,
      now: 600,
      playerPosition: { x: 40, y: 40 },
      portalId: 13,
      world: { width: 1000, height: 800 },
    });

    expect(forcedPreparation.attack?.portal.id).toBe(13);
  });
});

function createMonolith(position: { x: number; y: number }): GameEntity {
  return {
    angularVelocity: 0,
    hits: 1,
    id: 1,
    kind: 'monolith',
    membership: { space: 'rift' },
    position,
    rotation: 0,
    velocity: { x: 0, y: 0 },
  };
}

function createPortal(id = 1): PortalEntity {
  return {
    activeDurationMs: 1000,
    aperture: { radiusX: 80, radiusY: 40 },
    closeStartedAt: null,
    closingDurationMs: 200,
    id,
    lifecycle: 'active',
    normal: { x: 1, y: 0 },
    openedAt: 0,
    openingDurationMs: 200,
    position: { x: 600, y: 300 },
    viewPolicy: 'window',
    visualRadiusX: 100,
    visualRadiusY: 50,
  };
}

function getPortalPlaneIntersection(
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  portal: PortalEntity | null,
): { x: number; y: number } | null {
  if (!portal) return null;
  const velocityTowardPortal = dotVector(velocity, portal.normal);
  if (velocityTowardPortal <= 0) return null;
  const distanceToPlane = dotVector(subtractVector(portal.position, position), portal.normal);
  const timeToPlane = distanceToPlane / velocityTowardPortal;
  return {
    x: position.x + velocity.x * timeToPlane,
    y: position.y + velocity.y * timeToPlane,
  };
}
