import type { Vector } from '../core/types';
import { ENTITIES, type EntityKind } from './config';
import type { GameEntity } from './types';

let nextEntityId = 1;

export function createMonolith(
  position: Vector,
  velocity: Vector,
): GameEntity {
  const kind: EntityKind = 'monolith';
  return {
    angularVelocity: 0,
    hits: ENTITIES[kind].hits,
    id: nextEntityId++,
    kind,
    membership: { space: 'arcade' },
    position,
    rotation: 0,
    velocity,
  };
}
