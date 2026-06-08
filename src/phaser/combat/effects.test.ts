import { describe, expect, it } from 'vitest';

import type { AsteroidEntity } from '../asteroids/types';
import {
  createAsteroidExplosion,
  createAsteroidImpactDebris,
  createAsteroidPlanetImpactDebris,
  createExplosionBurst,
  createShipExplosion,
  createShipPlanetImpactDebris,
} from './effects';

describe('combat particle effects', () => {
  it('builds asteroid explosions from dense layered particle kinds', () => {
    const effect = createAsteroidExplosion(createAsteroid('big'), 1);

    expect(effect.particles.length).toBeGreaterThan(60);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'shard', 'shockwave', 'smoke', 'spark']),
    );
    expect(effect.particles.every((particle) => particle.affectedByPlanetGravity === false)).toBe(
      true,
    );
  });

  it('builds generic explosion particles that ignore planet gravity', () => {
    const effect = createExplosionBurst({ x: 120, y: 80 }, { x: 4, y: -2 }, 1);

    expect(effect.particles.every((particle) => particle.affectedByPlanetGravity === false)).toBe(
      true,
    );
  });

  it('creates impact debris with directional shards, sparks, and smoke', () => {
    const effect = createAsteroidImpactDebris(createAsteroid('medium'), { x: 8, y: 0 });

    expect(effect.particles.length).toBeGreaterThan(25);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['shard', 'smoke', 'spark']),
    );
  });

  it('creates planet impact debris that bounces outward from the surface normal', () => {
    const effect = createAsteroidPlanetImpactDebris({
      asteroid: { ...createAsteroid('medium'), velocity: { x: -8, y: 0 } },
      normal: { x: 1, y: 0 },
      position: { x: 200, y: 100 },
    });
    const averageVelocityX =
      effect.particles.reduce((sum, particle) => sum + particle.velocity.x, 0) /
      effect.particles.length;

    expect(effect.particles.length).toBeGreaterThan(20);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['shard', 'smoke', 'spark']),
    );
    expect(averageVelocityX).toBeGreaterThan(0);
  });

  it('includes ship debris and a full explosion burst on player death', () => {
    const effects = createShipExplosion({ x: 120, y: 80 }, { x: 4, y: -2 });
    const particles = effects.flatMap((effect) => effect.particles);

    expect(particles.length).toBeGreaterThan(80);
    expect(new Set(particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'panel', 'shard', 'shockwave', 'smoke', 'spark', 'wing']),
    );
  });

  it('creates ship planet impact debris that ejects away from the planet center', () => {
    const effect = createShipPlanetImpactDebris({
      normal: { x: 1, y: 0 },
      position: { x: 300, y: 100 },
      velocity: { x: -12, y: 0 },
    });
    const averageVelocityX =
      effect.particles.reduce((sum, particle) => sum + particle.velocity.x, 0) /
      effect.particles.length;

    expect(effect.particles.length).toBeGreaterThan(60);
    expect(new Set(effect.particles.map((particle) => particle.kind))).toEqual(
      new Set(['core', 'panel', 'shard', 'smoke', 'spark', 'wing']),
    );
    expect(averageVelocityX).toBeGreaterThan(0);
    expect(
      effect.particles
        .filter((particle) => ['panel', 'shard', 'wing'].includes(particle.kind))
        .every((particle) => particle.affectedByPlanetGravity === undefined),
    ).toBe(true);
    expect(
      effect.particles
        .filter((particle) => ['core', 'smoke', 'spark'].includes(particle.kind))
        .every((particle) => particle.affectedByPlanetGravity === false),
    ).toBe(true);
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
