import { describe, expect, it } from 'vitest';

import { getPortalCrossing } from './PortalTransferSystem';
import type { PortalEntity, TransferableEntitySnapshot } from './types';

const portal: PortalEntity = {
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
};

describe('getPortalCrossing', () => {
  it('moves arcade entities through the portal opposite the normal', () => {
    const entity = createEntity({
      previousPosition: { x: 340, y: 200 },
      position: { x: 260, y: 200 },
      space: 'arcade',
    });

    expect(getPortalCrossing({ current: entity, portal })?.toSpace).toBe('rift');
  });

  it('rejects arcade entities moving with the normal', () => {
    const entity = createEntity({
      previousPosition: { x: 260, y: 200 },
      position: { x: 340, y: 200 },
      space: 'arcade',
    });

    expect(getPortalCrossing({ current: entity, portal })).toBeNull();
  });

  it('moves rift entities back through the inverse direction', () => {
    const entity = createEntity({
      previousPosition: { x: 260, y: 200 },
      position: { x: 340, y: 200 },
      space: 'rift',
    });

    expect(getPortalCrossing({ current: entity, portal })?.toSpace).toBe('arcade');
  });

  it('requires the crossing point center to be inside the aperture', () => {
    const entity = createEntity({
      previousPosition: { x: 340, y: 320 },
      position: { x: 260, y: 320 },
      space: 'arcade',
    });

    expect(getPortalCrossing({ current: entity, portal })).toBeNull();
  });

  it('does not transfer while the portal is not active', () => {
    const entity = createEntity({
      previousPosition: { x: 340, y: 200 },
      position: { x: 260, y: 200 },
      space: 'arcade',
    });

    expect(
      getPortalCrossing({
        current: entity,
        portal: { ...portal, lifecycle: 'openingVisual' },
      }),
    ).toBeNull();
  });
});

function createEntity(input: {
  position: TransferableEntitySnapshot['position'];
  previousPosition: TransferableEntitySnapshot['previousPosition'];
  space: TransferableEntitySnapshot['membership']['space'];
}): TransferableEntitySnapshot {
  return {
    id: 1,
    kind: 'asteroid',
    membership: { space: input.space },
    position: input.position,
    previousPosition: input.previousPosition,
  };
}
