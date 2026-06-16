import type Phaser from 'phaser';

import type { GeneratedTextureGroup } from '../core/generatedTextureRegistry';
import type { EntityKind } from './config';
import {
  ensureMonolithCubeTextures,
  getMonolithCubeAnimationFrame,
  getMonolithCubeTextureCacheEntries,
  getMonolithCubeTextureKey,
  MONOLITH_CUBE_TEXTURE_KEY,
} from './monolithCubeTexture';
import type { GameEntity } from './types';

export const ENTITY_TEXTURE_KEYS: Record<EntityKind, string> = {
  monolith: MONOLITH_CUBE_TEXTURE_KEY,
};

export async function ensureEntityTextures(scene: Phaser.Scene): Promise<void> {
  await ensureMonolithCubeTextures(scene);
}

export const ENTITY_GENERATED_TEXTURE_GROUP = {
  cacheEntries: getMonolithCubeTextureCacheEntries(),
  ensure: ensureEntityTextures,
  key: 'entities',
  label: 'Entity sprites',
  textureKeys: getEntityTextureKeys(),
} satisfies GeneratedTextureGroup;

export function getEntityVisualTextureKey(entity: GameEntity, timeMs: number): string {
  if (entity.kind === 'monolith') {
    return getMonolithCubeTextureKey(getMonolithCubeAnimationFrame(timeMs, entity.id));
  }
  return ENTITY_TEXTURE_KEYS[entity.kind];
}

function getEntityTextureKeys(): string[] {
  return getMonolithCubeTextureCacheEntries().map((entry) => entry.textureKey);
}
