import { describe, expect, it } from 'vitest';

import type { PortalEntity } from '../dimensions/types';
import {
  BORDER_METABALLS,
  buildPortalMetaballData,
  CENTER_METABALLS,
  PORTAL_METABALL_COUNT,
} from './PortalMetaballSamples';

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
        expect(radius).toBeGreaterThanOrEqual(CENTER_METABALLS.radiusScaleMin);
        expect(radius).toBeLessThanOrEqual(CENTER_METABALLS.radiusScaleMax);
        expect(radius).toBeGreaterThan(BORDER_METABALLS.radiusScaleMax);
      } else {
        expect(distance).toBeGreaterThan(0.65);
        expect(radius).toBeGreaterThanOrEqual(BORDER_METABALLS.radiusScaleMin);
        expect(radius).toBeLessThanOrEqual(BORDER_METABALLS.radiusScaleMax);
      }
    }
  });
});
