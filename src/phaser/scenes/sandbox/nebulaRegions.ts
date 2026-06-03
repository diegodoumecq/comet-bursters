import type { Vector } from '../../core/types';

export type NebulaRegionEffect = 'fuelReplenish' | 'fuelAbsorb' | 'damage';

export type NebulaRegionColor = {
  b: number;
  g: number;
  r: number;
};

export type NebulaRegionVisuals = {
  alphaScale: number;
  blue: NebulaRegionColor;
  coreStrength: number;
  cyan: NebulaRegionColor;
  densityScale: number;
  hazeStrength: number;
  highlight: NebulaRegionColor;
  tint: NebulaRegionColor;
  tintStrength: number;
  violet: NebulaRegionColor;
};

export type NebulaRegion = {
  alpha: number;
  effects: NebulaRegionEffect[];
  featherPx: number;
  id: string;
  points: Vector[];
  seed: number;
  visuals?: NebulaRegionVisuals;
};
