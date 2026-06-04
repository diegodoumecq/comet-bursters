import type { AsteroidTier } from './types';
import type { MatterBodySpec } from '../core/matterBodySpec';

type AsteroidDefinition = {
  body: MatterBodySpec & {
    collisionRadius: number;
    mass: number;
  };
  gameplay: {
    child: AsteroidTier | null;
    hits: number;
    points: number;
    splitCount: number;
  };
  render: {
    color: number;
    radius: number;
  };
  spawn: {
    speed: number;
  };
};

export const ASTEROID_DEFINITIONS: Record<AsteroidTier, AsteroidDefinition> = {
  mega: {
    body: { bounce: 1, collisionRadius: 80, frictionAir: 0, mass: 10 },
    gameplay: { child: 'big', hits: 30, points: 10, splitCount: 3 },
    render: { color: 0xff6b6b, radius: 100 },
    spawn: { speed: 0.75 },
  },
  big: {
    body: { bounce: 1, collisionRadius: 55, frictionAir: 0, mass: 5 },
    gameplay: { child: 'medium', hits: 10, points: 20, splitCount: 2 },
    render: { color: 0xffd93d, radius: 70 },
    spawn: { speed: 1.3333 },
  },
  medium: {
    body: { bounce: 1, collisionRadius: 39, frictionAir: 0, mass: 2 },
    gameplay: { child: 'small', hits: 3, points: 50, splitCount: 2 },
    render: { color: 0x6bcb77, radius: 45 },
    spawn: { speed: 2.5 },
  },
  small: {
    body: { bounce: 1, collisionRadius: 21, frictionAir: 0, mass: 1 },
    gameplay: { child: null, hits: 1, points: 100, splitCount: 0 },
    render: { color: 0x4d96ff, radius: 25 },
    spawn: { speed: 4.3333 },
  },
};

export const ASTEROIDS: Record<
  AsteroidTier,
  {
    child: AsteroidTier | null;
    collisionRadius: number;
    color: number;
    hits: number;
    mass: number;
    points: number;
    radius: number;
    speed: number;
    splitCount: number;
  }
> = {
  mega: {
    child: ASTEROID_DEFINITIONS.mega.gameplay.child,
    collisionRadius: ASTEROID_DEFINITIONS.mega.body.collisionRadius,
    color: ASTEROID_DEFINITIONS.mega.render.color,
    hits: ASTEROID_DEFINITIONS.mega.gameplay.hits,
    mass: ASTEROID_DEFINITIONS.mega.body.mass,
    points: ASTEROID_DEFINITIONS.mega.gameplay.points,
    radius: ASTEROID_DEFINITIONS.mega.render.radius,
    speed: ASTEROID_DEFINITIONS.mega.spawn.speed,
    splitCount: ASTEROID_DEFINITIONS.mega.gameplay.splitCount,
  },
  big: {
    child: ASTEROID_DEFINITIONS.big.gameplay.child,
    collisionRadius: ASTEROID_DEFINITIONS.big.body.collisionRadius,
    color: ASTEROID_DEFINITIONS.big.render.color,
    hits: ASTEROID_DEFINITIONS.big.gameplay.hits,
    mass: ASTEROID_DEFINITIONS.big.body.mass,
    points: ASTEROID_DEFINITIONS.big.gameplay.points,
    radius: ASTEROID_DEFINITIONS.big.render.radius,
    speed: ASTEROID_DEFINITIONS.big.spawn.speed,
    splitCount: ASTEROID_DEFINITIONS.big.gameplay.splitCount,
  },
  medium: {
    child: ASTEROID_DEFINITIONS.medium.gameplay.child,
    collisionRadius: ASTEROID_DEFINITIONS.medium.body.collisionRadius,
    color: ASTEROID_DEFINITIONS.medium.render.color,
    hits: ASTEROID_DEFINITIONS.medium.gameplay.hits,
    mass: ASTEROID_DEFINITIONS.medium.body.mass,
    points: ASTEROID_DEFINITIONS.medium.gameplay.points,
    radius: ASTEROID_DEFINITIONS.medium.render.radius,
    speed: ASTEROID_DEFINITIONS.medium.spawn.speed,
    splitCount: ASTEROID_DEFINITIONS.medium.gameplay.splitCount,
  },
  small: {
    child: ASTEROID_DEFINITIONS.small.gameplay.child,
    collisionRadius: ASTEROID_DEFINITIONS.small.body.collisionRadius,
    color: ASTEROID_DEFINITIONS.small.render.color,
    hits: ASTEROID_DEFINITIONS.small.gameplay.hits,
    mass: ASTEROID_DEFINITIONS.small.body.mass,
    points: ASTEROID_DEFINITIONS.small.gameplay.points,
    radius: ASTEROID_DEFINITIONS.small.render.radius,
    speed: ASTEROID_DEFINITIONS.small.spawn.speed,
    splitCount: ASTEROID_DEFINITIONS.small.gameplay.splitCount,
  },
};
