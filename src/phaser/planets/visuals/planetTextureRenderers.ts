import Phaser from 'phaser';

import { createCanvasTexture } from '../../core/canvasTextures';
import type { PlanetTextureSizing } from '../textureSizing';
import type { PlanetEntity, PlanetKind, PlanetSpriteSource } from '../types';
import { createGasPlanetShaderTexture } from './gasPlanetShader';
import { createLavaPlanetShaderTexture } from './lavaPlanetShader';
import { drawPlanetLightingLayer, drawPlanetSurfaceLayer } from './planetVisuals';
import { createToxicPlanetShaderTexture } from './toxicPlanetShader';

export type PlanetTextureLayer = 'lighting' | 'surface';

type PlanetTextureRenderer = (
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
) => boolean;

const planetTextureRenderers: Partial<Record<PlanetKind, PlanetTextureRenderer>> = {
  gas: renderGasPlanetTexture,
  lava: renderLavaPlanetTexture,
  toxic: renderToxicPlanetTexture,
};

export function renderPlanetTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
  layer: PlanetTextureLayer,
): void {
  if (layer === 'lighting') {
    renderCanvasPlanetLayer(scene, textureKey, planet, sizing, layer);
    return;
  }

  const renderer = planetTextureRenderers[planet.kind];
  if (renderer) {
    if (renderer(scene, textureKey, planet, sizing)) return;
    throw new Error(`Unable to render ${planet.kind} planet shader texture`);
  }

  renderCanvasPlanetLayer(scene, textureKey, planet, sizing, layer);
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

function renderGasPlanetTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
): boolean {
  return createGasPlanetShaderTexture(
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

function renderCanvasPlanetLayer(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
  layer: PlanetTextureLayer,
): boolean {
  createCanvasTexture(scene, textureKey, sizing.textureSize, sizing.textureSize, (ctx) => {
    const spriteSource = toSpriteSource(planet, sizing.textureSize, sizing.textureScale);
    if (layer === 'surface') {
      drawPlanetSurfaceLayer(spriteSource, ctx);
      return;
    }
    drawPlanetLightingLayer(spriteSource, ctx);
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
