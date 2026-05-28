import { describe, expect, it } from 'vitest';

import { getPortalTransferDecision } from './portalTransfer';
import type { RiftPortal } from './types';

const portal: RiftPortal = {
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
};

describe('portal transfer decisions', () => {
  it('transfers arcade bodies inward into rift space', () => {
    const decision = getPortalTransferDecision(
      {
        membership: { space: 'arcade' },
        position: { x: 300, y: 200 },
        radius: 12,
        velocity: { x: -4, y: 0 },
      },
      portal,
    );

    expect(decision).toEqual({
      membership: { portalId: 2, space: 'rift' },
      position: { x: 700, y: 500 },
      space: 'rift',
      velocity: { x: 0, y: -4 },
    });
  });

  it('does not transfer arcade bodies moving outward', () => {
    const decision = getPortalTransferDecision(
      {
        membership: { space: 'arcade' },
        position: { x: 300, y: 200 },
        radius: 12,
        velocity: { x: 4, y: 0 },
      },
      portal,
    );

    expect(decision).toBeNull();
  });

  it('transfers rift bodies outward into arcade space after front clearance', () => {
    const decision = getPortalTransferDecision(
      {
        membership: { portalId: 2, space: 'rift' },
        position: { x: 700, y: 573 },
        radius: 12,
        velocity: { x: 5, y: 4 },
      },
      portal,
    );

    expect(decision).toEqual({
      membership: { space: 'arcade' },
      position: { x: 373, y: 200 },
      space: 'arcade',
      velocity: { x: 4, y: 5 },
    });
  });

  it('keeps rift bodies isolated from unrelated portals', () => {
    const decision = getPortalTransferDecision(
      {
        membership: { portalId: 9, space: 'rift' },
        position: { x: 700, y: 573 },
        radius: 12,
        velocity: { x: 5, y: 4 },
      },
      portal,
    );

    expect(decision).toBeNull();
  });
});
