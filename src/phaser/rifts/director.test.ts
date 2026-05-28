import { describe, expect, it } from 'vitest';

import { ArcadeRiftDirector } from './director';

describe('arcade rift director', () => {
  it('does not open another burst while a rift source space is still alive', () => {
    const director = new ArcadeRiftDirector();
    director.recordBurst(1000);

    expect(
      director.shouldOpenBurst({
        activeAsteroids: 0,
        now: 100000,
        openRifts: 1,
        stagedAsteroids: 0,
      }),
    ).toBe(false);
  });
});
