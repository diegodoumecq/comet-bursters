import Phaser from 'phaser';

import type { AsteroidEntity, ParticleEntity, Vector } from '../../model';
import { ASTEROIDS } from '../../services/asteroids';
import { spawnBurst } from '../../services/particles';

export type EffectResult = {
  particles: ParticleEntity[];
  shakeDurationMs: number;
  shakeIntensity: number;
};

export function createAsteroidExplosion(scene: Phaser.Scene, asteroid: AsteroidEntity, scale: number): EffectResult {
  const config = ASTEROIDS[asteroid.tier];
  return {
    particles: spawnBurst(scene, asteroid.body, {
      color: config.color,
      count: Math.max(8, Math.round(config.radius * 0.18 * scale)),
      inheritedVelocity: asteroid.velocity,
      lifetimeMs: 420,
      radius: { min: 2, max: Math.max(4, config.radius * 0.08) },
      speed: { min: 1.3333, max: 4.3333 * scale },
    }),
    shakeDurationMs: 180,
    shakeIntensity: Math.max(2, config.radius * 0.04 * scale),
  };
}

export function createExplosionBurst(scene: Phaser.Scene, position: Vector, inheritedVelocity: Vector, scale: number): EffectResult {
  return {
    particles: spawnBurst(scene, position, {
      color: 0xffffff,
      count: Math.round(10 * scale),
      inheritedVelocity,
      lifetimeMs: 260,
      radius: { min: 2, max: 5 * scale },
      speed: { min: 1.1667, max: 3.6667 * scale },
    }),
    shakeDurationMs: 240,
    shakeIntensity: 8 * scale,
  };
}

export function createShipExplosion(scene: Phaser.Scene, position: Vector, velocity: Vector): EffectResult[] {
  return [
    {
      particles: spawnBurst(scene, position, {
        color: 0xffb454,
        count: 26,
        inheritedVelocity: velocity,
        lifetimeMs: 680,
        radius: { min: 2, max: 7 },
        speed: { min: 1.8333, max: 6.5 },
      }),
      shakeDurationMs: 0,
      shakeIntensity: 0,
    },
    createExplosionBurst(scene, position, velocity, 1.4),
  ];
}

export function createThrusterParticles(
  scene: Phaser.Scene,
  position: Vector,
  velocity: Vector,
  move: Vector,
  thrustScale: number,
): ParticleEntity[] {
  return spawnBurst(scene, {
    x: position.x - move.x * 22,
    y: position.y - move.y * 22,
  }, {
    color: thrustScale < 1 ? 0x64748b : 0x38bdf8,
    count: 1,
    inheritedVelocity: {
      x: velocity.x - move.x * 4.3333,
      y: velocity.y - move.y * 4.3333,
    },
    lifetimeMs: thrustScale < 1 ? 180 : 240,
    radius: { min: thrustScale < 1 ? 2 : 3, max: thrustScale < 1 ? 4 : 6 },
    speed: { min: 0.1333, max: 0.4 },
  });
}
