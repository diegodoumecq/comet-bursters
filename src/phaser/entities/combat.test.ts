import { describe, expect, it } from 'vitest';

import { getBlackHoleEntityCollisionBlockers } from './combat';
import { ENTITIES } from './config';
import type { GameEntity } from './types';

function createEntity(input: Partial<GameEntity> = {}): GameEntity {
  return {
    angularVelocity: 0,
    hits: 3,
    id: 1,
    kind: 'monolith',
    position: { x: 12, y: 24 },
    rotation: 0,
    velocity: { x: 0, y: 0 },
    ...input,
  };
}

describe('entity collision blockers', () => {
  it('maps game entities to black-hole collision blockers', () => {
    const entity = createEntity();

    expect(getBlackHoleEntityCollisionBlockers([entity])).toEqual([
      {
        position: entity.position,
        radius: ENTITIES.monolith.collisionRadius,
      },
    ]);
  });
});
