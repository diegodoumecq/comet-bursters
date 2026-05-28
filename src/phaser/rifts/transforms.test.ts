import { describe, expect, it } from 'vitest';

import {
  arcadeToPortalLocal,
  arcadeToRift,
  arcadeVelocityToRift,
  portalLocalToArcade,
  portalLocalToRift,
  riftToArcade,
  riftToPortalLocal,
  riftVelocityToArcade,
} from './transforms';
import type { RiftPortal } from './types';

const portal: RiftPortal = {
  angle: Math.PI / 2,
  apertureRadiusX: 100,
  apertureRadiusY: 60,
  closeDurationMs: 500,
  closeStartedAt: null,
  durationMs: 5000,
  id: 3,
  openDurationMs: 400,
  openedAt: 0,
  position: { x: 300, y: 200 },
  radiusX: 100,
  radiusY: 60,
  sourcePosition: { x: 800, y: 600 },
  state: 'active',
};

describe('rift coordinate transforms', () => {
  it('round trips arcade positions through portal local coordinates', () => {
    const arcadePosition = { x: 260, y: 230 };
    const localPosition = arcadeToPortalLocal(portal, arcadePosition);

    expect(localPosition.x).toBeCloseTo(40);
    expect(localPosition.y).toBeCloseTo(30);
    expect(portalLocalToArcade(portal, localPosition).x).toBeCloseTo(arcadePosition.x);
    expect(portalLocalToArcade(portal, localPosition).y).toBeCloseTo(arcadePosition.y);
  });

  it('round trips rift positions through portal local coordinates', () => {
    const riftPosition = { x: 825, y: 550 };
    const localPosition = riftToPortalLocal(portal, riftPosition);

    expect(localPosition).toEqual({ x: 25, y: -50 });
    expect(portalLocalToRift(portal, localPosition)).toEqual(riftPosition);
  });

  it('converts arcade positions to rift positions without losing portal-local offset', () => {
    const arcadePosition = { x: 260, y: 230 };
    const riftPosition = arcadeToRift(portal, arcadePosition);

    expect(riftPosition.x).toBeCloseTo(840);
    expect(riftPosition.y).toBeCloseTo(630);
    expect(riftToArcade(portal, riftPosition).x).toBeCloseTo(arcadePosition.x);
    expect(riftToArcade(portal, riftPosition).y).toBeCloseTo(arcadePosition.y);
  });

  it('preserves velocity magnitude across transfer transforms', () => {
    const arcadeVelocity = { x: -12, y: 5 };
    const riftVelocity = arcadeVelocityToRift(portal, arcadeVelocity);
    const restoredVelocity = riftVelocityToArcade(portal, riftVelocity);

    expect(Math.hypot(riftVelocity.x, riftVelocity.y)).toBeCloseTo(
      Math.hypot(arcadeVelocity.x, arcadeVelocity.y),
    );
    expect(restoredVelocity.x).toBeCloseTo(arcadeVelocity.x);
    expect(restoredVelocity.y).toBeCloseTo(arcadeVelocity.y);
  });
});
