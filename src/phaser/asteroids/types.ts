import type { Vector } from '../core/types';
import type { SpaceMembership } from '../dimensions/types';

export type AsteroidTier = 'small' | 'medium' | 'big' | 'mega';

export type AsteroidEntity = {
  id: number;
  hits?: number;
  membership?: SpaceMembership;
  position: Vector;
  splitGroupId?: number;
  tier: AsteroidTier;
  velocity: Vector;
  visualVariant: number;
};
