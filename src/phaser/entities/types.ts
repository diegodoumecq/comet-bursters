import type { Vector } from '../core/types';
import type { SpaceMembership } from '../dimensions/types';
import type { EntityKind } from './config';

export type GameEntity = {
  angularVelocity: number;
  gravityScale?: number;
  hits?: number;
  id: number;
  kind: EntityKind;
  membership?: SpaceMembership;
  position: Vector;
  rotation: number;
  velocity: Vector;
};
