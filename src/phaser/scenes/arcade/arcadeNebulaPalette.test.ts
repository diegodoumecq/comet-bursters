import { describe, expect, it } from 'vitest';

import { getArcadeNebulaPalette } from './arcadeNebulaPalette';

describe('arcade nebula palettes', () => {
  it('keeps wave one on the default blue palette', () => {
    expect(getArcadeNebulaPalette(1)).toEqual({
      base: { r: 0.045, g: 0.12, b: 0.32 },
      secondary: { r: 0.13, g: 0.075, b: 0.24 },
      accent: { r: 0.08, g: 0.28, b: 0.38 },
      thread: { r: 0.08, g: 0.28, b: 0.38 },
    });
  });

  it('cycles palettes deterministically by wave', () => {
    expect(getArcadeNebulaPalette(6)).toEqual(getArcadeNebulaPalette(1));
    expect(getArcadeNebulaPalette(7)).toEqual(getArcadeNebulaPalette(2));
  });

  it('maps later starting waves directly to their palette', () => {
    expect(getArcadeNebulaPalette(4)).not.toEqual(getArcadeNebulaPalette(1));
    expect(getArcadeNebulaPalette(14)).toEqual(getArcadeNebulaPalette(4));
  });
});
