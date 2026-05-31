import { describe, expect, it } from 'vitest';

import { syncPortalLifecycle } from './PortalLifecycle';
import type { PortalEntity } from './types';

describe('syncPortalLifecycle', () => {
  it('keeps gameplay inactive during opening and closing visuals', () => {
    const portal = createPortal();

    expect(syncPortalLifecycle(portal, 100)).toBe('openingVisual');
    expect(syncPortalLifecycle(portal, 250)).toBe('active');
    expect(syncPortalLifecycle(portal, 1300)).toBe('closingVisual');
    expect(portal.closeStartedAt).toBe(1200);
    expect(syncPortalLifecycle(portal, 1450)).toBe('closed');
  });
});

function createPortal(): PortalEntity {
  return {
    activeDurationMs: 1000,
    aperture: { radiusX: 100, radiusY: 60 },
    closeStartedAt: null,
    closingDurationMs: 200,
    id: 1,
    lifecycle: 'openingVisual',
    normal: { x: 1, y: 0 },
    openedAt: 0,
    openingDurationMs: 200,
    position: { x: 300, y: 200 },
    viewPolicy: 'window',
    visualRadiusX: 120,
    visualRadiusY: 80,
  };
}
