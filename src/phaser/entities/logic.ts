import Phaser from 'phaser';

import type { RandomSource } from '../core/random';
import type { Vector } from '../core/types';
import { ENTITIES, type EntityKind } from './config';
import type { GameEntity } from './types';

let nextEntityId = 1;

export function createMonolith(
  position: Vector,
  velocity: Vector,
  random: RandomSource = phaserRandom,
): GameEntity {
  const kind: EntityKind = 'monolith';
  return {
    angularVelocity: random.floatBetween(-0.025, 0.025),
    hits: ENTITIES[kind].hits,
    id: nextEntityId++,
    kind,
    membership: { space: 'arcade' },
    position,
    rotation: random.floatBetween(0, Math.PI * 2),
    velocity,
  };
}

const phaserRandom: RandomSource = {
  between: (min, max) => Phaser.Math.Between(min, max),
  float: () => Math.random(),
  floatBetween: (min, max) => Phaser.Math.FloatBetween(min, max),
  pick: (items) => items[Phaser.Math.Between(0, items.length - 1)],
};
