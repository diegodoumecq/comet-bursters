import type { AsteroidTier } from '../../asteroids/types';
import type { Vector, WorldSize } from '../../core/types';
import type { PlanetKind } from '../../planets/types';
import type {
  NebulaRegion,
  NebulaRegionColor,
  NebulaRegionEffect,
  NebulaRegionVisuals,
} from './nebulaRegions';
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
  color?: NebulaRegionColor;
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

export type SandboxGeneratedBiomePreset = WeightedValue<string> & {
  maxDistance?: number;
  minDistance?: number;
};

export type SandboxAuthoredAsteroidConfig = {
  position: Vector;
  tier: AsteroidTier;
  velocity?: Vector;
};

export type SandboxAuthoredPlanetConfig = {
  kind: PlanetKind;
  position: Vector;
};

export type SandboxPlanetAsteroidBeltLandmarkConfig = {
  asteroidCount: number;
  asteroidTier?: AsteroidTier;
  id: string;
  orbitRadius: number;
  planet: SandboxAuthoredPlanetConfig;
  type: 'planetAsteroidBelt';
};

export type SandboxLandmarkConfig = SandboxPlanetAsteroidBeltLandmarkConfig;

export type SandboxWorldConfig = {
  authoredBiomes: SandboxBiomeConfig[];
  authoredAsteroids: SandboxAuthoredAsteroidConfig[];
  authoredNebulaRegions: NebulaRegion[];
  authoredPlanets: SandboxAuthoredPlanetConfig[];
  biomePresets: Record<string, SandboxBiomePreset>;
  defaultBiomePresets: string[];
  generatedBiomePresets: SandboxGeneratedBiomePreset[];
  generatedBiomeSize: number;
  landmarks: SandboxLandmarkConfig[];
  spawnPoint: Vector;
  world: WorldSize;
};

export const SANDBOX_WORLD_CONFIG: SandboxWorldConfig = sandboxWorldConfig as SandboxWorldConfig;
