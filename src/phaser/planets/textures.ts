import Phaser from 'phaser';

import type { PlanetEntity, PlanetSpriteSource } from './types';
import { drawStyledPlanet } from './visuals/planetVisuals';

const PLANET_CACHE_PADDING = 80;
const PLANET_TEXTURE_EXTENT_SCALE = 1.7;
const PLANET_TEXTURE_VERSION = 'legacy-render-v6';
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

  const textureKey = `phaser-planet-${textureKeys.size}`;
  const canvas = createPlanetCanvas(planet);
  scene.textures.addCanvas(textureKey, canvas);
  textureKeys.set(cacheKey, textureKey);
  return textureKey;
}

export function getPlanetTextureSize(planet: PlanetEntity): number {
  const extent = planet.radius * PLANET_TEXTURE_EXTENT_SCALE + PLANET_CACHE_PADDING;
  return Math.ceil(extent * 2);
}

function createPlanetCanvas(planet: PlanetEntity): HTMLCanvasElement {
  const size = getPlanetTextureSize(planet);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawStyledPlanet(toSpriteSource(planet, size), ctx);
  }
  return canvas;
}

function toSpriteSource(planet: PlanetEntity, canvasSize: number): PlanetSpriteSource {
  return {
    altitudeVariations: planet.altitudeVariations,
    color: planet.colorHex,
    getRadius: () => planet.radius,
    kind: planet.kind,
    rotation: 0,
    x: canvasSize * 0.5,
    y: canvasSize * 0.5,
  };
}
