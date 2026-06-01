import { describe, expect, it } from 'vitest';

import type { PortalEntity } from '../dimensions/types';
import { getPortalVisualScale } from './portalVisualScale';

const portal: PortalEntity = {
  activeDurationMs: 1000,
  aperture: { radiusX: 100, radiusY: 60 },
  closeStartedAt: null,
  closingDurationMs: 200,
  id: 1,
  lifecycle: 'active',
  normal: { x: 1, y: 0 },
  openedAt: 100,
  openingDurationMs: 200,
  position: { x: 300, y: 200 },
  viewPolicy: 'window',
  visualRadiusX: 120,
  visualRadiusY: 80,
};

describe('getPortalVisualScale', () => {
  it('grows from zero to full size while opening', () => {
    expect(getPortalVisualScale(portal, 100)).toBe(0);
    expect(getPortalVisualScale(portal, 200)).toBeGreaterThan(0);
    expect(getPortalVisualScale(portal, 300)).toBe(1);
  });

  it('shrinks from full size to zero while closing', () => {
    expect(
      getPortalVisualScale(
        {
          ...portal,
          closeStartedAt: 500,
        },
        500,
      ),
    ).toBe(1);
    expect(
      getPortalVisualScale(
        {
          ...portal,
          closeStartedAt: 500,
        },
        600,
      ),
    ).toBeLessThan(1);
    expect(
      getPortalVisualScale(
        {
          ...portal,
          closeStartedAt: 500,
        },
        700,
      ),
    ).toBe(0);
  });
});
