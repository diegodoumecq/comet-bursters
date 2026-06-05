import { describe, expect, it } from 'vitest';

import { PLANET_SPECS } from './config';
import { getPlanetDisplaySizeForRadius, getPlanetTextureSizing } from './textureSizing';

describe('planet texture sizing', () => {
  it('caps large planets below the renderer upload limit', () => {
    const radius = PLANET_SPECS.gas.radius;
    const displaySize = getPlanetDisplaySizeForRadius(radius);
    const sizing = getPlanetTextureSizing(radius, 4096);

    expect(displaySize).toBeGreaterThan(2048);
    expect(sizing).toEqual({
      displaySize,
      textureScale: 1024 / displaySize,
      textureSize: 1024,
    });
  });

  it('caps large planets when there is no renderer texture cap', () => {
    const radius = PLANET_SPECS.gas.radius;
    const displaySize = getPlanetDisplaySizeForRadius(radius);
    const sizing = getPlanetTextureSizing(radius, null);

    expect(sizing).toEqual({
      displaySize,
      textureScale: 1024 / displaySize,
      textureSize: 1024,
    });
  });

  it('uses the smaller renderer cap when required', () => {
    const radius = PLANET_SPECS.gas.radius;
    const displaySize = getPlanetDisplaySizeForRadius(radius);
    const sizing = getPlanetTextureSizing(radius, 768);

    expect(sizing).toEqual({
      displaySize,
      textureScale: 768 / displaySize,
      textureSize: 768,
    });
  });

  it('keeps smaller planets at display resolution', () => {
    const radius = PLANET_SPECS.lush.radius;
    const displaySize = getPlanetDisplaySizeForRadius(radius);
    const sizing = getPlanetTextureSizing(radius, 4096);

    expect(displaySize).toBeLessThan(1024);
    expect(sizing).toEqual({
      displaySize,
      textureScale: 1,
      textureSize: displaySize,
    });
  });
});
