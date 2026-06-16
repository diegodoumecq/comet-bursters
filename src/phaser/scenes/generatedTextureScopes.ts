import type Phaser from 'phaser';

import { ASTEROID_GENERATED_TEXTURE_GROUP } from '../asteroids/textures';
import type { GeneratedAssetCacheEntry } from '../core/generatedAssetCache';
import {
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
  textureCount: number;
};

export type GeneratedTextureRuntimeStats = {
  groups: GeneratedTextureRuntimeGroupStats[];
  loadedTextures: number;
  totalTextures: number;
};

const ASTEROID_GENERATED_TEXTURE_GROUPS = [ASTEROID_GENERATED_TEXTURE_GROUP] as const;
const MONOLITH_SPACE_GENERATED_TEXTURE_GROUPS = [
  ASTEROID_GENERATED_TEXTURE_GROUP,
  ENTITY_GENERATED_TEXTURE_GROUP,
] as const;
const DEMO_FOCUSED_GENERATED_TEXTURE_GROUPS = [ASTEROID_GENERATED_TEXTURE_GROUP] as const;

// Keep these scopes intentional. Sandbox is asteroid-only because normal sandbox startup does
// not create monolith entities; arcade/rift/demo do need monolith frames available.
const SCENE_GENERATED_TEXTURE_GROUPS: Record<
  SceneGeneratedTextureScope,
  readonly GeneratedTextureGroup[]
> = {
  arcade: MONOLITH_SPACE_GENERATED_TEXTURE_GROUPS,
  demo: MONOLITH_SPACE_GENERATED_TEXTURE_GROUPS,
  'rift-space': MONOLITH_SPACE_GENERATED_TEXTURE_GROUPS,
  sandbox: ASTEROID_GENERATED_TEXTURE_GROUPS,
  'ship-interior': [],
};

const ALL_GENERATED_TEXTURE_GROUPS = [
  PLAYER_GENERATED_TEXTURE_GROUP,
  ASTEROID_GENERATED_TEXTURE_GROUP,
  ENTITY_GENERATED_TEXTURE_GROUP,
] as const;

export function getGeneratedTextureGroupsForScope(
  scope: SceneGeneratedTextureScope,
): readonly GeneratedTextureGroup[] {
  // Focused demo profiles isolate planet/asteroid texture rendering and intentionally skip
  // unrelated monolith showcase frames while keeping the full cache registry valid for pruning.
  if (scope === 'demo' && isFocusedDemoTechniqueActive())
    return DEMO_FOCUSED_GENERATED_TEXTURE_GROUPS;
  return SCENE_GENERATED_TEXTURE_GROUPS[scope];
}

export function getAllGeneratedTextureCacheEntries(): GeneratedAssetCacheEntry[] {
  return ALL_GENERATED_TEXTURE_GROUPS.flatMap((group) => [...group.cacheEntries]);
}

export async function ensureGeneratedTextureScope(
  scene: Phaser.Scene,
  scope: SceneGeneratedTextureScope,
  options?: EnsureGeneratedTextureGroupsOptions,
): Promise<void> {
  await ensureGeneratedTextureGroups(scene, getGeneratedTextureGroupsForScope(scope), options);
}

export function getGeneratedTextureRuntimeStats(
  scene?: Phaser.Scene,
): GeneratedTextureRuntimeStats {
  const groups = ALL_GENERATED_TEXTURE_GROUPS.map((group) => {
    const loadedTextures = scene
      ? group.textureKeys.filter((textureKey) => scene.textures.exists(textureKey)).length
      : 0;
    return {
      groupKey: group.key,
      loadedTextures,
      textureCount: group.textureKeys.length,
    };
  });
  return {
    groups,
    loadedTextures: groups.reduce((total, group) => total + group.loadedTextures, 0),
    totalTextures: groups.reduce((total, group) => total + group.textureCount, 0),
  };
}

function isFocusedDemoTechniqueActive(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.__demoPerfTechnique;
  return raw === 'asteroid-atlas-rotation' || raw === 'planet-texture-cache';
}

declare global {
  interface Window {
    __demoPerfTechnique?: string;
  }
}
