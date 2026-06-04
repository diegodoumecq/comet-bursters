import { describe, expect, it } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import {
  createAsteroidExplosion,
  createAsteroidImpactDebris,
  createShipExplosion,
} from './effects';

describe('combat particle effects', () => {
  it('builds asteroid explosions from dense layered particle kinds', () => {
    const effect = createAsteroidExplosion(createAsteroid('big'), 1);

    expect(effect.particles.length).toBeGreaterThan(60);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'shard', 'shockwave', 'smoke', 'spark']),
    );
  });

  it('creates impact debris with directional shards, sparks, and smoke', () => {
    const effect = createAsteroidImpactDebris(createAsteroid('medium'), { x: 8, y: 0 });

    expect(effect.particles.length).toBeGreaterThan(25);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['shard', 'smoke', 'spark']),
    );
  });

  it('includes ship debris and a full explosion burst on player death', () => {
    const effects = createShipExplosion({ x: 120, y: 80 }, { x: 4, y: -2 });
    const particles = effects.flatMap((effect) => effect.particles);

    expect(particles.length).toBeGreaterThan(80);
    expect(new Set(particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'panel', 'shard', 'shockwave', 'smoke', 'spark', 'wing']),
    );
  });
});

function createAsteroid(tier: AsteroidEntity['tier']): AsteroidEntity {
  return {
    angularVelocity: 0,
    id: 1,
    position: { x: 100, y: 100 },
    rotation: 0,
    tier,
    velocity: { x: 2, y: -1 },
    visualVariant: 0,
  };
}
