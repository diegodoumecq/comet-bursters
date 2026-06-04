import { describe, expect, it } from 'vitest';

import { PLANET_SPECS } from './config';
import { getPlanetDisplaySizeForRadius, getPlanetTextureSizing } from './textureSizing';

describe('planet texture sizing', () => {
  it('keeps large planets full-detail when the renderer can upload them', () => {
    const radius = PLANET_SPECS.gas.radius;
    const displaySize = getPlanetDisplaySizeForRadius(radius);
    const sizing = getPlanetTextureSizing(radius, 4096);

    expect(displaySize).toBeGreaterThan(2048);
    expect(sizing).toEqual({
      displaySize,
      textureScale: 1,
      textureSize: displaySize,
    });
  });

  it('keeps large planets full-detail when there is no renderer texture cap', () => {
    const radius = PLANET_SPECS.gas.radius;
    const displaySize = getPlanetDisplaySizeForRadius(radius);
    const sizing = getPlanetTextureSizing(radius, null);

    expect(sizing).toEqual({
      displaySize,
      textureScale: 1,
      textureSize: displaySize,
    });
  });

  it('downscales only when the renderer texture cap requires it', () => {
    const radius = PLANET_SPECS.gas.radius;
    const displaySize = getPlanetDisplaySizeForRadius(radius);
    const sizing = getPlanetTextureSizing(radius, 2048);

    expect(sizing).toEqual({
      displaySize,
      textureScale: 2048 / displaySize,
      textureSize: 2048,
    });
  });
});
