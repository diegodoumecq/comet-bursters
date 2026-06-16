import type Phaser from 'phaser';

import { ASTEROID_GENERATED_TEXTURE_GROUP } from '../asteroids/textures';
import type { GeneratedAssetCacheEntry } from '../core/generatedAssetCache';
import {
  collectGeneratedTextureCacheEntries,
  collectGeneratedTextureKeys,
  ensureGeneratedTextureGroups,
  type EnsureGeneratedTextureGroupsOptions,
  type GeneratedTextureGroup,
} from '../core/generatedTextureRegistry';
import { ENTITY_GENERATED_TEXTURE_GROUP } from '../entities/textures';
import { PLAYER_GENERATED_TEXTURE_GROUP } from '../player/textures';

export type SceneGeneratedTextureScope =
  | 'arcade'
  | 'demo'
  | 'rift-space'
  | 'sandbox'
  | 'ship-interior';

type GeneratedTextureRuntimeGroupStats = {
  groupKey: string;
  loadedTextures: number;
  refCount: number;
  textureCount: number;
};

export type GeneratedTextureRuntimeStats = {
  groups: GeneratedTextureRuntimeGroupStats[];
  loadedTextures: number;
  totalTextures: number;
};

const DEMAND_SPACE_GENERATED_TEXTURE_GROUPS = [
  ASTEROID_GENERATED_TEXTURE_GROUP,
  ENTITY_GENERATED_TEXTURE_GROUP,
] as const;

const SCENE_GENERATED_TEXTURE_GROUPS: Record<
  SceneGeneratedTextureScope,
  readonly GeneratedTextureGroup[]
> = {
  arcade: DEMAND_SPACE_GENERATED_TEXTURE_GROUPS,
  demo: DEMAND_SPACE_GENERATED_TEXTURE_GROUPS,
  'rift-space': DEMAND_SPACE_GENERATED_TEXTURE_GROUPS,
  sandbox: DEMAND_SPACE_GENERATED_TEXTURE_GROUPS,
  'ship-interior': [],
};

const ALL_GENERATED_TEXTURE_GROUPS = [
  PLAYER_GENERATED_TEXTURE_GROUP,
  ASTEROID_GENERATED_TEXTURE_GROUP,
  ENTITY_GENERATED_TEXTURE_GROUP,
] as const;

const groupByKey = new Map(ALL_GENERATED_TEXTURE_GROUPS.map((group) => [group.key, group]));
const refCounts = new Map<string, number>();
const pendingUnloadTimers = new Map<string, ReturnType<typeof setTimeout>>();
const sceneRegistrations = new WeakMap<Phaser.Scene, Set<string>>();
const scenesWithReleaseHooks = new WeakSet<Phaser.Scene>();

export function getGeneratedTextureGroupsForScope(
  scope: SceneGeneratedTextureScope,
): readonly GeneratedTextureGroup[] {
  return SCENE_GENERATED_TEXTURE_GROUPS[scope];
}

export function getAllGeneratedTextureCacheEntries(): GeneratedAssetCacheEntry[] {
  return collectGeneratedTextureCacheEntries(ALL_GENERATED_TEXTURE_GROUPS);
}

export async function ensureGeneratedTexturesForScope(
  scene: Phaser.Scene,
  scope: SceneGeneratedTextureScope,
  options?: EnsureGeneratedTextureGroupsOptions,
): Promise<void> {
  await ensureGeneratedTextureGroups(scene, getGeneratedTextureGroupsForScope(scope), options);
}

export function registerGeneratedTextureScope(
  scene: Phaser.Scene,
  scope: SceneGeneratedTextureScope,
): void {
  const groups = getGeneratedTextureGroupsForScope(scope);
  if (groups.length === 0) return;

  const registeredGroups = getSceneRegisteredGroups(scene);
  for (const group of groups) {
    if (!registeredGroups.has(group.key)) {
      registeredGroups.add(group.key);
      retainGeneratedTextureGroup(group.key);
    }
  }

  if (!scenesWithReleaseHooks.has(scene)) {
    scenesWithReleaseHooks.add(scene);
    scene.events.once('shutdown', () => releaseGeneratedTextureScopes(scene));
  }
}

export function getGeneratedTextureRuntimeStats(
  scene?: Phaser.Scene,
): GeneratedTextureRuntimeStats {
  const groups = ALL_GENERATED_TEXTURE_GROUPS.map((group) => {
    const textureKeys = collectGeneratedTextureKeys([group]);
    const loadedTextures = scene
      ? textureKeys.filter((textureKey) => scene.textures.exists(textureKey)).length
      : 0;
    return {
      groupKey: group.key,
      loadedTextures,
      refCount: refCounts.get(group.key) ?? 0,
      textureCount: textureKeys.length,
    };
  });
  return {
    groups,
    loadedTextures: groups.reduce((total, group) => total + group.loadedTextures, 0),
    totalTextures: groups.reduce((total, group) => total + group.textureCount, 0),
  };
}

function getSceneRegisteredGroups(scene: Phaser.Scene): Set<string> {
  const existing = sceneRegistrations.get(scene);
  if (existing) return existing;

  const registeredGroups = new Set<string>();
  sceneRegistrations.set(scene, registeredGroups);
  return registeredGroups;
}

function retainGeneratedTextureGroup(groupKey: string): void {
  const pendingUnload = pendingUnloadTimers.get(groupKey);
  if (pendingUnload) {
    clearTimeout(pendingUnload);
    pendingUnloadTimers.delete(groupKey);
  }
  refCounts.set(groupKey, (refCounts.get(groupKey) ?? 0) + 1);
}

function releaseGeneratedTextureScopes(scene: Phaser.Scene): void {
  const registeredGroups = sceneRegistrations.get(scene);
  scenesWithReleaseHooks.delete(scene);
  if (!registeredGroups) return;

  for (const groupKey of registeredGroups) {
    releaseGeneratedTextureGroup(scene, groupKey);
  }
  registeredGroups.clear();
}

function releaseGeneratedTextureGroup(scene: Phaser.Scene, groupKey: string): void {
  const nextCount = Math.max(0, (refCounts.get(groupKey) ?? 0) - 1);
  if (nextCount > 0) {
    refCounts.set(groupKey, nextCount);
    return;
  }

  refCounts.delete(groupKey);
  const group = groupByKey.get(groupKey);
  if (!group) return;

  const timer = setTimeout(() => unloadGeneratedTextureGroup(scene, group), 0);
  pendingUnloadTimers.set(groupKey, timer);
}

function unloadGeneratedTextureGroup(scene: Phaser.Scene, group: GeneratedTextureGroup): void {
  pendingUnloadTimers.delete(group.key);
  if ((refCounts.get(group.key) ?? 0) > 0) return;

  for (const textureKey of collectGeneratedTextureKeys([group])) {
    if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  }
}
