import type Phaser from 'phaser';

import {
  ensureGeneratedTextureGroups,
  type EnsureGeneratedTextureGroupsOptions,
} from '../../core/generatedTextureRegistry';
import { PLAYER_GENERATED_TEXTURE_GROUP } from '../../player/textures';

export const BOOT_GENERATED_TEXTURE_GROUPS = [PLAYER_GENERATED_TEXTURE_GROUP] as const;

export async function ensureBootGeneratedTextures(
  scene: Phaser.Scene,
  options?: EnsureGeneratedTextureGroupsOptions,
): Promise<void> {
  await ensureGeneratedTextureGroups(scene, BOOT_GENERATED_TEXTURE_GROUPS, options);
}
