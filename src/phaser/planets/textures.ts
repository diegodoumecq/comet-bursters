import Phaser from 'phaser';

import { createCanvasTexture } from '../core/canvasTextures';
import { getPlanetDisplaySizeForRadius, getPlanetTextureSizing } from './textureSizing';
import type { PlanetEntity, PlanetSpriteSource } from './types';
import { drawStyledPlanet } from './visuals/planetVisuals';

const PLANET_TEXTURE_VERSION = 'v20-shared-capped-direct-painter-surface';
const textureKeys = new Map<string, string>();

export function getPlanetTextureKey(scene: Phaser.Scene, planet: PlanetEntity): string {
  const cacheKey = [PLANET_TEXTURE_VERSION, planet.kind, planet.colorHex, planet.radius].join('|');
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
  createCanvasTexture(scene, textureKey, sizing.textureSize, sizing.textureSize, (ctx) => {
    drawStyledPlanet(toSpriteSource(planet, sizing.textureSize, sizing.textureScale), ctx);
  });
}

function getRendererMaxTextureSize(scene: Phaser.Scene): number | null {
  const renderer = scene.sys.renderer;
  if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
    const maxTextureSize = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE);
    if (typeof maxTextureSize === 'number' && maxTextureSize > 0) return maxTextureSize;
  }
  return null;
}

function toSpriteSource(
  planet: PlanetEntity,
  canvasSize: number,
  textureScale: number,
): PlanetSpriteSource {
  return {
    altitudeVariations: planet.altitudeVariations,
    color: planet.colorHex,
    getRadius: () => planet.radius * textureScale,
    kind: planet.kind,
    rotation: 0,
    x: canvasSize * 0.5,
    y: canvasSize * 0.5,
  };
}
