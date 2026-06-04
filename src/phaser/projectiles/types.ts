import type { Vector } from '../core/types';
import type { SpaceMembership } from '../dimensions/types';
import type { ProjectileKind } from '../weapons/types';

export type ProjectileEntity = {
  absorbedFuel: number;
  ageMs: number;
  angle: number;
  airResistance: number;
  baseSpeed: number;
  blackHoleMass?: number;
  collapseStartedAt: number | null;
  createdAt: number;
  damage: number;
  id: number;
  impact: number;
  kind: ProjectileKind;
  lifetimeMs: number;
  membership?: SpaceMembership;
  position: Vector;
  radius: number;
  velocity: Vector;
};
