import type { AsteroidTier } from './types';

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
    child: 'big',
    collisionRadius: 80,
    color: 0xff6b6b,
    hits: 30,
    mass: 10,
    points: 10,
    radius: 100,
    speed: 0.75,
    splitCount: 3,
  },
  big: {
    child: 'medium',
    collisionRadius: 55,
    color: 0xffd93d,
    hits: 10,
    mass: 5,
    points: 20,
    radius: 70,
    speed: 1.3333,
    splitCount: 2,
  },
  medium: {
    child: 'small',
    collisionRadius: 39,
    color: 0x6bcb77,
    hits: 3,
    mass: 2,
    points: 50,
    radius: 45,
    speed: 2.5,
    splitCount: 2,
  },
  small: {
    child: null,
    collisionRadius: 21,
    color: 0x4d96ff,
    hits: 1,
    mass: 1,
    points: 100,
    radius: 25,
    speed: 4.3333,
    splitCount: 0,
  },
};
