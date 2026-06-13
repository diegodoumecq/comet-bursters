import Phaser from 'phaser';

import type { PlanetTextureSizing } from '../textureSizing';
import type { PlanetEntity, PlanetKind } from '../types';
import { createGasPlanetShaderTexture } from './gasPlanetShader';
import { createLavaPlanetShaderTexture } from './lavaPlanetShader';
import { createPlanetLightingShaderTexture } from './planetLighting';
import { createTerrainPlanetShaderTexture } from './terrainPlanetShader';
import { createToxicPlanetShaderTexture } from './toxicPlanetShader';

export type PlanetTextureLayer = 'lighting' | 'surface';

type PlanetTextureRenderer = (
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
) => boolean;

const planetTextureRenderers: Record<PlanetKind, PlanetTextureRenderer> = {
  crystal: renderTerrainPlanetTexture,
  desert: renderTerrainPlanetTexture,
  gas: renderGasPlanetTexture,
  ice: renderTerrainPlanetTexture,
  lava: renderLavaPlanetTexture,
  lush: renderTerrainPlanetTexture,
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
    renderPlanetLightingTexture(scene, textureKey, planet, sizing);
    return;
  }

  const renderer = planetTextureRenderers[planet.kind];
  if (renderer(scene, textureKey, planet, sizing)) return;
  throw new Error(`Unable to render ${planet.kind} planet shader texture`);
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

function renderTerrainPlanetTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
): boolean {
  return createTerrainPlanetShaderTexture(
    scene,
    textureKey,
    planet,
    sizing.textureSize,
    sizing.textureScale,
  );
}

function renderPlanetLightingTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  sizing: PlanetTextureSizing,
): boolean {
  return createPlanetLightingShaderTexture(
    scene,
    textureKey,
    planet,
    sizing.textureSize,
    sizing.textureScale,
  );
}
