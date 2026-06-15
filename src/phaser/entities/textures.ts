import Phaser from 'phaser';

import type { EntityKind } from './config';
import type { GameEntity } from './types';
import {
  createMonolithCubeTexture,
  getMonolithCubeAnimationFrame,
  getMonolithCubeTextureKey,
  MONOLITH_CUBE_TEXTURE_KEY,
} from './monolithCubeTexture';

export const ENTITY_TEXTURE_KEYS: Record<EntityKind, string> = {
  monolith: MONOLITH_CUBE_TEXTURE_KEY,
};

export function createEntityTextures(scene: Phaser.Scene): void {
  createMonolithCubeTexture(scene);
}

export function getEntityVisualTextureKey(entity: GameEntity, timeMs: number): string {
  if (entity.kind === 'monolith') {
    return getMonolithCubeTextureKey(getMonolithCubeAnimationFrame(timeMs, entity.id));
  }
  return ENTITY_TEXTURE_KEYS[entity.kind];
}
