import Phaser from 'phaser';

import { createCanvasTexture } from '../../core/canvasTextures';
import type { PlanetTextureSizing } from '../textureSizing';
import type { PlanetEntity, PlanetKind, PlanetSpriteSource } from '../types';
import { createLavaPlanetShaderTexture } from './lavaPlanetShader';
import { drawStyledPlanet } from './planetVisuals';
import { createToxicPlanetShaderTexture } from './toxicPlanetShader';

type PlanetTextureRenderer = (
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
) => boolean;

const planetTextureRenderers: Partial<Record<PlanetKind, PlanetTextureRenderer>> = {
  lava: renderLavaPlanetTexture,
  toxic: renderToxicPlanetTexture,
};

export function renderPlanetTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
): void {
  const renderer = planetTextureRenderers[planet.kind];
  if (renderer) {
    if (renderer(scene, textureKey, planet, sizing)) return;
    throw new Error(`Unable to render ${planet.kind} planet shader texture`);
  }

  renderCanvasPlanetTexture(scene, textureKey, planet, sizing);
}

function renderLavaPlanetTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
): boolean {
  return createLavaPlanetShaderTexture(
    scene,
    textureKey,
    planet,
    sizing.textureSize,
    sizing.textureScale,
  );
}

function renderToxicPlanetTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
): boolean {
  return createToxicPlanetShaderTexture(
    scene,
    textureKey,
    planet,
    sizing.textureSize,
    sizing.textureScale,
  );
}

function renderCanvasPlanetTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
): boolean {
  createCanvasTexture(scene, textureKey, sizing.textureSize, sizing.textureSize, (ctx) => {
    drawStyledPlanet(toSpriteSource(planet, sizing.textureSize, sizing.textureScale), ctx);
  });
  return true;
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
