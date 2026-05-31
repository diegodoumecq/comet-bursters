import { describe, expect, it } from 'vitest';

import { getPortalBridgePairs } from './PortalInteractionBridge';
import type { PortalEntity, TransferableEntitySnapshot } from './types';

const portal: PortalEntity = {
  activeDurationMs: 1000,
  aperture: { radiusX: 80, radiusY: 50 },
  closeStartedAt: null,
  closingDurationMs: 200,
  id: 1,
  lifecycle: 'active',
  normal: { x: 1, y: 0 },
  openedAt: 0,
  openingDurationMs: 200,
  position: { x: 300, y: 200 },
  viewPolicy: 'window',
  visualRadiusX: 110,
  visualRadiusY: 70,
};

describe('getPortalBridgePairs', () => {
  it('pairs opposite-dimension entities whose centers are inside the active aperture', () => {
    const pairs = getPortalBridgePairs({
      arcade: [entity(1, 'arcade', { x: 300, y: 200 })],
      portal,
      rift: [entity(2, 'rift', { x: 320, y: 220 })],
    });

    expect(pairs).toHaveLength(1);
  });

  it('ignores entities outside the aperture', () => {
    const pairs = getPortalBridgePairs({
      arcade: [entity(1, 'arcade', { x: 300, y: 200 })],
      portal,
      rift: [entity(2, 'rift', { x: 300, y: 300 })],
    });

    expect(pairs).toHaveLength(0);
  });

  it('is disabled while the portal is visually opening', () => {
    const pairs = getPortalBridgePairs({
      arcade: [entity(1, 'arcade', { x: 300, y: 200 })],
      portal: { ...portal, lifecycle: 'openingVisual' },
      rift: [entity(2, 'rift', { x: 300, y: 200 })],
    });

    expect(pairs).toHaveLength(0);
  });
});

function entity(
  id: number,
  space: TransferableEntitySnapshot['membership']['space'],
  position: TransferableEntitySnapshot['position'],
): TransferableEntitySnapshot {
  return {
    id,
    kind: 'asteroid',
    membership: { space },
    position,
    previousPosition: position,
  };
}
