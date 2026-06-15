import { ASTEROIDS } from '../asteroids/config';
import type { MatterBodySpec } from '../core/matterBodySpec';

export type EntityKind = 'monolith';

type EntityDefinition = {
  body: MatterBodySpec & {
    collisionRadius: number;
    mass: number;
  };
  gameplay: {
    hits: number;
  };
  render: {
    color: number;
    lineColor: number;
    size: number;
  };
};

export const ENTITY_DEFINITIONS: Record<EntityKind, EntityDefinition> = {
  monolith: {
    body: {
      bounce: 1,
      collisionRadius: ASTEROIDS.medium.collisionRadius,
      fixedRotation: true,
      frictionAir: 0,
      mass: 20,
    },
    gameplay: {
      hits: 30000000000,
    },
    render: {
      color: 0x000000,
      lineColor: 0xffffff,
      size: ASTEROIDS.medium.radius * 2,
    },
  },
};

export const ENTITIES: Record<
  EntityKind,
  {
    collisionRadius: number;
    color: number;
    hits: number;
    lineColor: number;
    mass: number;
    size: number;
  }
> = {
  monolith: {
    collisionRadius: ENTITY_DEFINITIONS.monolith.body.collisionRadius,
    color: ENTITY_DEFINITIONS.monolith.render.color,
    hits: ENTITY_DEFINITIONS.monolith.gameplay.hits,
    lineColor: ENTITY_DEFINITIONS.monolith.render.lineColor,
    mass: ENTITY_DEFINITIONS.monolith.body.mass,
    size: ENTITY_DEFINITIONS.monolith.render.size,
  },
};
