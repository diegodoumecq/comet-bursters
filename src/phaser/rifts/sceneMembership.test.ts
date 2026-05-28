import { describe, expect, it } from 'vitest';

import {
  circleClearedPortalFront,
  circleOverlapsPortalAperture,
  getScenePositionInRiftSpace,
  shouldEnterRift,
  shouldExitRift,
} from './sceneMembership';
import type { RiftPortal } from './types';

const portal: RiftPortal = {
  angle: 0,
  apertureRadiusX: 100,
  apertureRadiusY: 60,
  closeDurationMs: 500,
  closeStartedAt: null,
  durationMs: 5000,
  id: 1,
  openDurationMs: 400,
  openedAt: 0,
  position: { x: 300, y: 200 },
  radiusX: 100,
  radiusY: 60,
  sourcePosition: { x: 180, y: 190 },
  state: 'active',
};

describe('rift scene membership', () => {
  it('projects scene positions into portal local space', () => {
    expect(getScenePositionInRiftSpace(portal, { x: 310, y: 225 })).toEqual({ x: 25, y: 10 });
  });

  it('detects aperture overlap using circle radius', () => {
    expect(circleOverlapsPortalAperture({ x: 108, y: 0 }, portal, 10)).toBe(true);
    expect(circleOverlapsPortalAperture({ x: 112, y: 0 }, portal, 10)).toBe(false);
  });

  it('requires front clearance before exiting rift membership', () => {
    expect(circleClearedPortalFront({ x: 0, y: 70 }, portal, 10)).toBe(false);
    expect(circleClearedPortalFront({ x: 0, y: 71 }, portal, 10)).toBe(true);
    expect(circleClearedPortalFront({ x: 110, y: 200 }, portal, 10)).toBe(false);
  });

  it('enters only when moving inward through the aperture', () => {
    expect(
      shouldEnterRift({
        inRift: false,
        localPosition: { x: 0, y: 0 },
        localVelocity: { x: 0, y: -1 },
        portal,
        radius: 10,
      }),
    ).toBe(true);
    expect(
      shouldEnterRift({
        inRift: false,
        localPosition: { x: 130, y: 0 },
        localVelocity: { x: 0, y: -1 },
        portal,
        radius: 10,
      }),
    ).toBe(false);
  });

  it('exits only after moving outward beyond the front aperture', () => {
    expect(
      shouldExitRift({
        inRift: true,
        localPosition: { x: 0, y: 71 },
        localVelocity: { x: 0, y: 1 },
        portal,
        radius: 10,
      }),
    ).toBe(true);
    expect(
      shouldExitRift({
        inRift: true,
        localPosition: { x: 0, y: 71 },
        localVelocity: { x: 0, y: -1 },
        portal,
        radius: 10,
      }),
    ).toBe(false);
  });
});
