import type { Vector } from '../core/types';
import type { ParticleEntity } from './types';

type BurstOptions = {
  color: number;
  count: number;
  inheritedVelocity?: Vector;
  lifetimeMs: number;
  radius: { max: number; min: number };
  speed: { max: number; min: number };
};

type DirectedBurstOptions = BurstOptions & {
  direction: Vector;
  spreadRadians: number;
};

let nextParticleId = 1;

export function spawnBurst(position: Vector, options: BurstOptions): ParticleEntity[] {
  const inherited = options.inheritedVelocity ?? { x: 0, y: 0 };
  const particles: ParticleEntity[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Phaser.Math.FloatBetween(options.speed.min, options.speed.max);
    particles.push({
      alphaDecayPerSecond: 1 / (options.lifetimeMs / 1000),
      color: options.color,
      dragPerSecond: 1.8,
      id: nextParticleId++,
      kind: 'circle',
      lifetimeMs: options.lifetimeMs,
      maxLifetimeMs: options.lifetimeMs,
      position: { x: position.x, y: position.y },
      radius: Phaser.Math.FloatBetween(options.radius.min, options.radius.max),
      rotation: 0,
      velocity: {
        x: inherited.x * 0.18 + Math.cos(angle) * speed,
        y: inherited.y * 0.18 + Math.sin(angle) * speed,
      },
    });
  }
  return particles;
}

export function spawnDirectedBurst(
  position: Vector,
  options: DirectedBurstOptions,
): ParticleEntity[] {
  const inherited = options.inheritedVelocity ?? { x: 0, y: 0 };
  const directionLength = Math.hypot(options.direction.x, options.direction.y);
  const direction =
    directionLength > 0
      ? { x: options.direction.x / directionLength, y: options.direction.y / directionLength }
      : { x: 1, y: 0 };
  const baseAngle = Math.atan2(direction.y, direction.x);
  const particles: ParticleEntity[] = [];
  for (let index = 0; index < options.count; index += 1) {
    const angle =
      baseAngle +
      Phaser.Math.FloatBetween(-options.spreadRadians * 0.5, options.spreadRadians * 0.5);
    const speed = Phaser.Math.FloatBetween(options.speed.min, options.speed.max);
    particles.push({
      alphaDecayPerSecond: 1 / (options.lifetimeMs / 1000),
      color: options.color,
      dragPerSecond: 1.8,
      id: nextParticleId++,
      kind: 'circle',
      lifetimeMs: options.lifetimeMs,
      maxLifetimeMs: options.lifetimeMs,
      position: { x: position.x, y: position.y },
      radius: Phaser.Math.FloatBetween(options.radius.min, options.radius.max),
      rotation: 0,
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
  particle.position.x += (particle.velocity.x * deltaMs) / (1000 / 60);
  particle.position.y += (particle.velocity.y * deltaMs) / (1000 / 60);
  if (particle.rotationSpeed) {
    particle.rotation += (particle.rotationSpeed * deltaMs) / (1000 / 60);
  }
  return particle.lifetimeMs > 0;
}

export function spawnThrusterParticle(
  position: Vector,
  direction: Vector,
  power: number,
): ParticleEntity | null {
  if (Math.abs(direction.x) < 0.01 && Math.abs(direction.y) < 0.01) return null;
  const clampedPower = Math.max(0.1, Math.min(1, power));
  const spread = 0.32 + clampedPower * 0.18;
  const randomAngle = Phaser.Math.FloatBetween(-spread * 0.5, spread * 0.5);
  const cos = Math.cos(randomAngle);
  const sin = Math.sin(randomAngle);
  const vx = direction.x * cos - direction.y * sin;
  const vy = direction.x * sin + direction.y * cos;
  const speed = Phaser.Math.FloatBetween(4, 10) * (0.38 + clampedPower * 0.62);
  const lifetimeFactor = 0.5 + Math.pow(Math.random(), 0.55) * 0.5;
  const lifetimeMs = 700 * lifetimeFactor;
  const size = Phaser.Math.FloatBetween(8, 16) * (0.58 + clampedPower * 0.42);
  const color =
    clampedPower < 0.5
      ? Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xbfdbfe),
          Phaser.Display.Color.ValueToColor(0x38bdf8),
          100,
          Math.round((lifetimeFactor - 0.5) * 200),
        )
      : Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xfff93d),
          Phaser.Display.Color.ValueToColor(0xff3f05),
          100,
          Math.round((lifetimeFactor - 0.5) * 200),
        );
  return {
    alphaDecayPerSecond: 1 / 0.7,
    color: Phaser.Display.Color.GetColor(color.r, color.g, color.b),
    dragPerSecond: 3.08,
    id: nextParticleId++,
    kind: 'thruster',
    lifetimeMs,
    maxLifetimeMs: 700,
    position: { x: position.x, y: position.y },
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: Phaser.Math.FloatBetween(-0.05, 0.05),
    size,
    velocity: { x: vx * speed, y: vy * speed },
  };
}

export function updateParticles(particles: ParticleEntity[], deltaMs: number): ParticleEntity[] {
  return particles.filter((particle) => !updateParticle(particle, deltaMs));
}
