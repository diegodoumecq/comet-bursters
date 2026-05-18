import type { Vector } from '../core/types';

export type ParticleEntity = {
  alphaDecayPerSecond: number;
  color: number;
  dragPerSecond: number;
  id: number;
  kind: 'circle' | 'thruster';
  lifetimeMs: number;
  maxLifetimeMs: number;
  position: Vector;
  radius?: number;
  rotation: number;
  rotationSpeed?: number;
  size?: number;
  velocity: Vector;
};
