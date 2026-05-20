import type { Vector } from '../core/types';
import type { ProjectileKind } from '../weapons/types';

export type ProjectileEntity = {
  absorbedFuel: number;
  ageMs: number;
  angle: number;
  blackHoleMass?: number;
  collapseStartedAt: number | null;
  createdAt: number;
  id: number;
  kind: ProjectileKind;
  lifetimeMs: number;
  position: Vector;
  velocity: Vector;
};
