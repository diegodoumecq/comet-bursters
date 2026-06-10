import Phaser from 'phaser';

import { getPlanetDisplaySizeForRadius, getPlanetTextureSizing } from './textureSizing';
import type { PlanetEntity } from './types';
import { renderPlanetTexture } from './visuals/planetTextureRenderers';

const PLANET_TEXTURE_VERSION = 'v49-gas-purple-no-spot';
const textureKeys = new Map<string, string>();

export function getPlanetTextureKey(scene: Phaser.Scene, planet: PlanetEntity): string {
  const cacheKey = [
    PLANET_TEXTURE_VERSION,
    planet.kind,
    planet.colorHex,
    planet.radius,
    planet.altitudeVariations.map((value) => value.toFixed(3)).join(','),
  ].join('|');
  const cached = textureKeys.get(cacheKey);
  if (cached && scene.textures.exists(cached)) return cached;

  const textureKey = `phaser-planet-${PLANET_TEXTURE_VERSION}-${textureKeys.size}`;
  createPlanetTexture(scene, textureKey, planet);
  textureKeys.set(cacheKey, textureKey);
  return textureKey;
}

export function getPlanetDisplaySize(planet: PlanetEntity): number {
  return getPlanetDisplaySizeForRadius(planet.radius);
}

function createPlanetTexture(scene: Phaser.Scene, textureKey: string, planet: PlanetEntity): void {
  const sizing = getPlanetTextureSizing(planet.radius, getRendererMaxTextureSize(scene));
  renderPlanetTexture(scene, textureKey, planet, sizing);
}

function getRendererMaxTextureSize(scene: Phaser.Scene): number | null {
  const renderer = scene.sys.renderer;
  if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
    const maxTextureSize = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE);
    if (typeof maxTextureSize === 'number' && maxTextureSize > 0) return maxTextureSize;
  }
  return null;
}
