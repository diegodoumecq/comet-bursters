import type { Vector } from '../core/types';

export type AsteroidTier = 'small' | 'medium' | 'big' | 'mega';

export type AsteroidEntity = {
  id: number;
  hits?: number;
  position: Vector;
  splitGroupId?: number;
  tier: AsteroidTier;
  velocity: Vector;
  visualVariant: number;
};
