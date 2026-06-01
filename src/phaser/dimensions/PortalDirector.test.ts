import { describe, expect, it, vi } from 'vitest';

import { PortalDirector } from './PortalDirector';
import { wrappedDistance } from './portalGeometry';

describe('PortalDirector', () => {
  it('creates active plans with a safe wrapped player distance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const director = new PortalDirector();
    const playerPosition = { x: 50, y: 50 };
    const plan = director.createPortalPlan({
      now: 100,
      playerPosition,
      portalId: 7,
      world: { width: 1200, height: 800 },
    });

    expect(plan.portal.id).toBe(7);
    expect(plan.portal.lifecycle).toBe('openingVisual');
    expect(plan.spawn.asteroidCount).toBeGreaterThan(0);
    expect(
      wrappedDistance(plan.portal.position, playerPosition, { width: 1200, height: 800 }),
    ).toBeGreaterThanOrEqual(260);
  });

  it('does not open another portal while one is active', () => {
    const director = new PortalDirector();

    expect(director.shouldOpenPortal({ activePortal: true, now: 10_000 })).toBe(false);
  });

  it('uses an explicit portal view policy when provided', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const director = new PortalDirector();
    const plan = director.createPortalPlan({
      now: 100,
      playerPosition: { x: 50, y: 50 },
      portalId: 7,
      viewPolicy: 'cameraTransfer',
      world: { width: 1200, height: 800 },
    });

    expect(plan.portal.viewPolicy).toBe('cameraTransfer');
  });
});
