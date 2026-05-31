import type { Vector } from '../core/types';
import type { SpaceMembership } from '../dimensions/types';

export type ParticleEntity = {
  alphaDecayPerSecond: number;
  color: number;
  dragPerSecond: number;
  id: number;
  kind: 'circle' | 'thruster';
  lifetimeMs: number;
  membership?: SpaceMembership;
  maxLifetimeMs: number;
  position: Vector;
  radius?: number;
  rotation: number;
  rotationSpeed?: number;
  size?: number;
  velocity: Vector;
};
