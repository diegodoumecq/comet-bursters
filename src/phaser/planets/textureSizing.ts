const PLANET_CACHE_PADDING = 80;
const PLANET_MAX_TEXTURE_SIZE = 1024;
const PLANET_TEXTURE_EXTENT_SCALE = 1.7;

export type PlanetTextureSizing = {
  displaySize: number;
  textureScale: number;
  textureSize: number;
};

export function getPlanetDisplaySizeForRadius(radius: number): number {
  const extent = radius * PLANET_TEXTURE_EXTENT_SCALE + PLANET_CACHE_PADDING;
  return Math.ceil(extent * 2);
}

export function getPlanetTextureSizing(
  radius: number,
  maxTextureSize: number | null,
): PlanetTextureSizing {
  const displaySize = getPlanetDisplaySizeForRadius(radius);
  const textureLimit = maxTextureSize
    ? Math.min(maxTextureSize, PLANET_MAX_TEXTURE_SIZE)
    : PLANET_MAX_TEXTURE_SIZE;
  const textureSize = Math.min(displaySize, textureLimit);
  return {
    displaySize,
    textureScale: textureSize / displaySize,
    textureSize,
  };
}
