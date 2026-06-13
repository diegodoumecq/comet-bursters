import Phaser from 'phaser';

import { getPlanetDisplaySizeForRadius, getPlanetTextureSizing } from './textureSizing';
import type { PlanetEntity } from './types';
import { renderPlanetTexture, type PlanetTextureLayer } from './visuals/planetTextureRenderers';

const PLANET_TEXTURE_VERSION = 'v103-fewer-visible-small-crystal-plates';
const textureKeys = new Map<string, string>();

export type PlanetTextureKeys = {
  lighting: string;
  surface: string;
};

export function getPlanetTextureKeys(scene: Phaser.Scene, planet: PlanetEntity): PlanetTextureKeys {
  return {
    lighting: getPlanetTextureKey(scene, planet, 'lighting'),
    surface: getPlanetTextureKey(scene, planet, 'surface'),
  };
}

function getPlanetTextureKey(
  scene: Phaser.Scene,
  planet: PlanetEntity,
  layer: PlanetTextureLayer,
): string {
  const cacheKey = [
    PLANET_TEXTURE_VERSION,
    layer,
    planet.kind,
    planet.colorHex,
    planet.radius,
    planet.id,
    planet.altitudeVariations.map((value) => value.toFixed(3)).join(','),
  ].join('|');
  const cached = textureKeys.get(cacheKey);
  if (cached && scene.textures.exists(cached)) return cached;

  const textureKey = `phaser-planet-${PLANET_TEXTURE_VERSION}-${layer}-${textureKeys.size}`;
  createPlanetTexture(scene, textureKey, planet, layer);
  textureKeys.set(cacheKey, textureKey);
  return textureKey;
}

export function getPlanetDisplaySize(planet: PlanetEntity): number {
  return getPlanetDisplaySizeForRadius(planet.radius);
}

function createPlanetTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  layer: PlanetTextureLayer,
): void {
  const sizing = getPlanetTextureSizing(planet.radius, getRendererMaxTextureSize(scene));
  renderPlanetTexture(scene, textureKey, planet, sizing, layer);
}

function getRendererMaxTextureSize(scene: Phaser.Scene): number | null {
  const renderer = scene.sys.renderer;
  if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
    const maxTextureSize = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE);
    if (typeof maxTextureSize === 'number' && maxTextureSize > 0) return maxTextureSize;
  }
  return null;
}
