import { describe, expect, it } from 'vitest';

import { createMonolith } from './logic';

describe('createMonolith', () => {
  it('creates non-rotating monoliths', () => {
    const monolith = createMonolith({ x: 12, y: 24 }, { x: 1, y: -1 });

    expect(monolith.rotation).toBe(0);
    expect(monolith.angularVelocity).toBe(0);
  });
});
