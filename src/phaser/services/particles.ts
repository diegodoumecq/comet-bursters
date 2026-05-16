import Phaser from 'phaser';

import type { ParticleEntity, Vector } from '../model';

type BurstOptions = {
  color: number;
  count: number;
  inheritedVelocity?: Vector;
  lifetimeMs: number;
  radius: { max: number; min: number };
  speed: { max: number; min: number };
};

export function spawnBurst(
  scene: Phaser.Scene,
  position: Vector,
  options: BurstOptions,
): ParticleEntity[] {
  const inherited = options.inheritedVelocity ?? { x: 0, y: 0 };
  const particles: ParticleEntity[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Phaser.Math.FloatBetween(options.speed.min, options.speed.max);
    particles.push({
      alphaDecayPerSecond: 1 / (options.lifetimeMs / 1000),
      dragPerSecond: 1.8,
      lifetimeMs: options.lifetimeMs,
      shape: scene.add.circle(
        position.x,
        position.y,
        Phaser.Math.FloatBetween(options.radius.min, options.radius.max),
        options.color,
      ),
      velocity: {
        x: inherited.x * 0.18 + Math.cos(angle) * speed,
        y: inherited.y * 0.18 + Math.sin(angle) * speed,
      },
    });
  }
  return particles;
}

export function updateParticle(particle: ParticleEntity, deltaMs: number): boolean {
  particle.lifetimeMs -= deltaMs;
  const deltaSeconds = deltaMs / 1000;
  const drag = Math.exp(-particle.dragPerSecond * deltaSeconds);
  particle.velocity.x *= drag;
  particle.velocity.y *= drag;
  particle.shape.setPosition(
    particle.shape.x + particle.velocity.x * deltaSeconds,
    particle.shape.y + particle.velocity.y * deltaSeconds,
  );
  particle.shape.setAlpha(Math.max(0, particle.shape.alpha - particle.alphaDecayPerSecond * deltaSeconds));
  return particle.lifetimeMs > 0;
}

export function updateParticles(particles: ParticleEntity[], deltaMs: number): ParticleEntity[] {
  return particles.filter((particle) => !updateParticle(particle, deltaMs));
}
