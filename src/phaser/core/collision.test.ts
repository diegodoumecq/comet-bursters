import { describe, expect, it } from 'vitest';

import { circleContains, circlesOverlap } from './collision';

describe('circle collision helpers', () => {
  it('detects overlap at the combined radii boundary', () => {
    expect(circlesOverlap(28, 18, 10)).toBe(true);
    expect(circlesOverlap(28.01, 18, 10)).toBe(false);
  });

  it('detects point containment at the radius boundary', () => {
    expect(circleContains(25, 25)).toBe(true);
    expect(circleContains(25.01, 25)).toBe(false);
  });
});
