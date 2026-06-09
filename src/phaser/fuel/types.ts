import type { Vector } from '../core/types';
import type { SpaceMembership } from '../dimensions/types';

export type FuelBlobEntity = {
  id: number;
  airResistance: number;
  collectableAtMs?: number;
  gravityScale?: number;
  membership?: SpaceMembership;
  position: Vector;
  velocity: Vector;
  wobbleSeed: number;
};
