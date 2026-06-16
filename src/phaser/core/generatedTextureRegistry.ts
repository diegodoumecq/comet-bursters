import type Phaser from 'phaser';

import type { GeneratedAssetCacheEntry } from './generatedAssetCache';

export type GeneratedTextureGroup = {
  cacheEntries: readonly GeneratedAssetCacheEntry[];
  ensure: (scene: Phaser.Scene) => Promise<void> | void;
  key: string;
  label: string;
  textureKeys: readonly string[];
};

export type GeneratedTextureGroupProgress = {
  group: GeneratedTextureGroup;
  index: number;
  total: number;
};

export type EnsureGeneratedTextureGroupsOptions = {
  onGroupComplete?: (progress: GeneratedTextureGroupProgress) => Promise<void> | void;
  onGroupStart?: (progress: GeneratedTextureGroupProgress) => Promise<void> | void;
};

export async function ensureGeneratedTextureGroups(
  scene: Phaser.Scene,
  groups: readonly GeneratedTextureGroup[],
  options: EnsureGeneratedTextureGroupsOptions = {},
): Promise<void> {
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const progress = { group, index, total: groups.length };
    await options.onGroupStart?.(progress);
    await group.ensure(scene);
    await options.onGroupComplete?.(progress);
  }
}
