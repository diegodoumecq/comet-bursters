import type Phaser from 'phaser';

import { ASTEROID_GENERATED_TEXTURE_GROUP } from '../../asteroids/textures';
import {
  ensureGeneratedTextureGroups,
  type EnsureGeneratedTextureGroupsOptions,
} from '../../core/generatedTextureRegistry';
import { ENTITY_GENERATED_TEXTURE_GROUP } from '../../entities/textures';
import { PLAYER_GENERATED_TEXTURE_GROUP } from '../../player/textures';

export const BOOT_GENERATED_TEXTURE_GROUPS = [
  PLAYER_GENERATED_TEXTURE_GROUP,
  ASTEROID_GENERATED_TEXTURE_GROUP,
  ENTITY_GENERATED_TEXTURE_GROUP,
] as const;

export async function ensureBootGeneratedTextures(
  scene: Phaser.Scene,
  options?: EnsureGeneratedTextureGroupsOptions,
): Promise<void> {
  await ensureGeneratedTextureGroups(scene, BOOT_GENERATED_TEXTURE_GROUPS, options);
}
