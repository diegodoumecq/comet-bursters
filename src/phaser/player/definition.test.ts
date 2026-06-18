import { describe, expect, it } from 'vitest';

import { PLAYER_DEFINITIONS } from './definition';

describe('PLAYER_DEFINITIONS', () => {
  it('keeps arcade ship rotation controlled by input rather than collision torque', () => {
    expect(PLAYER_DEFINITIONS.arcade.body.fixedRotation).toBe(true);
  });
});
