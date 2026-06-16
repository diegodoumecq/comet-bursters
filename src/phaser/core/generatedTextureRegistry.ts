import type Phaser from 'phaser';

export type GeneratedTextureGroup = {
  ensure: (scene: Phaser.Scene) => Promise<void> | void;
  key: string;
  label: string;
};

export type GeneratedTextureGroupProgress = {
  group: GeneratedTextureGroup;
  index: number;
  total: number;
};

export type EnsureGeneratedTextureGroupsOptions = {
  onGroupComplete?: (progress: GeneratedTextureGroupProgress) => void;
  onGroupStart?: (progress: GeneratedTextureGroupProgress) => void;
};

export async function ensureGeneratedTextureGroups(
  scene: Phaser.Scene,
  groups: readonly GeneratedTextureGroup[],
  options: EnsureGeneratedTextureGroupsOptions = {},
): Promise<void> {
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const progress = { group, index, total: groups.length };
    options.onGroupStart?.(progress);
    await group.ensure(scene);
    options.onGroupComplete?.(progress);
  }
}
