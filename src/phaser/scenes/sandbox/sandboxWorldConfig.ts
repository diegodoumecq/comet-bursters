import type { AsteroidTier } from '../../asteroids/types';
import type { Vector, WorldSize } from '../../core/types';
import type { PlanetKind } from '../../planets/types';
import type { NebulaRegion, NebulaRegionEffect, NebulaRegionVisuals } from './nebulaRegions';
import sandboxWorldConfig from './sandboxWorldConfig.json';

export type WeightedValue<T> = {
  value: T;
  weight: number;
};

export type SandboxNebulaEffectCombo = {
  effects: NebulaRegionEffect[];
};

export type SandboxBiomePreset = {
  asteroidDensity?: number;
  asteroidTiers?: WeightedValue<AsteroidTier>[];
  nebulaDensity?: number;
  nebulaEffectCombos?: WeightedValue<SandboxNebulaEffectCombo>[];
  nebulaVisuals?: NebulaRegionVisuals;
  planetDensity?: number;
  planetKinds?: WeightedValue<PlanetKind>[];
};

export type SandboxBiomeConfig = SandboxBiomePreset & {
  id: string;
  points: Vector[];
  presets: string[];
};

export type SandboxWorldConfig = {
  authoredBiomes: SandboxBiomeConfig[];
  authoredNebulaRegions: NebulaRegion[];
  biomePresets: Record<string, SandboxBiomePreset>;
  defaultBiomePresets: string[];
  generatedBiomeSize: number;
  seed: string;
  world: WorldSize;
};

export const SANDBOX_WORLD_CONFIG: SandboxWorldConfig = sandboxWorldConfig as SandboxWorldConfig;
