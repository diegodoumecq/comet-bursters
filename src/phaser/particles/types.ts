import type { Vector } from '../core/types';
import type { SpaceMembership } from '../dimensions/types';

export type ParticleKind =
  | 'circle'
  | 'core'
  | 'panel'
  | 'shard'
  | 'shockwave'
  | 'smoke'
  | 'spark'
  | 'thruster'
  | 'wing';

export type ParticleEntity = {
  alphaDecayPerSecond: number;
  color: number;
  color2?: number;
  dragPerSecond: number;
  glowColor?: number;
  id: number;
  kind: ParticleKind;
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
