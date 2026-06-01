import { describe, expect, it } from 'vitest';

import type { PortalEntity } from '../dimensions/types';
import { buildPortalMetaballData, PORTAL_METABALL_COUNT, CENTER_METABALLS } from './PortalMetaballSamples';

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

describe('buildPortalMetaballData', () => {
  it('places large center metaballs and smaller border metaballs around the oval', () => {
    const data = buildPortalMetaballData(portal, 1000);

    for (let index = 0; index < PORTAL_METABALL_COUNT; index += 1) {
      const x = data[index * 4] / portal.visualRadiusX;
      const y = data[index * 4 + 1] / portal.visualRadiusY;
      const radius = data[index * 4 + 2] / portal.visualRadiusY;
      const distance = Math.hypot(x, y);

      expect(distance).toBeLessThan(1.08);
      if (index < CENTER_METABALLS.count) {
        expect(distance).toBeLessThan(0.48);
        expect(radius).toBeGreaterThan(0.9);
      } else {
        expect(distance).toBeGreaterThan(0.65);
        expect(radius).toBeLessThan(0.45);
      }
    }
  });
});
