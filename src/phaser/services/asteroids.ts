import Phaser from 'phaser';

import type { AsteroidEntity, AsteroidTier, MatterImage, Vector, WorldSize } from '../model';

export const ASTEROIDS: Record<AsteroidTier, {
  child: AsteroidTier | null;
  color: number;
  hits: number;
  mass: number;
  points: number;
  radius: number;
  speed: number;
  splitCount: number;
}> = {
  mega: { child: 'big', color: 0xff6b6b, hits: 30, mass: 10, points: 10, radius: 100, speed: 0.75, splitCount: 3 },
  big: { child: 'medium', color: 0xffd93d, hits: 10, mass: 5, points: 20, radius: 70, speed: 1.3333, splitCount: 2 },
  medium: { child: 'small', color: 0x6bcb77, hits: 3, mass: 2, points: 50, radius: 45, speed: 2.5, splitCount: 2 },
  small: { child: null, color: 0x4d96ff, hits: 1, mass: 1, points: 100, radius: 25, speed: 4.3333, splitCount: 0 },
};

export function wrapAsteroid(asteroid: AsteroidEntity, world: WorldSize): void {
  const radius = ASTEROIDS[asteroid.tier].radius;
  if (asteroid.body.x < -radius) asteroid.body.x = world.width + radius;
  if (asteroid.body.x > world.width + radius) asteroid.body.x = -radius;
  if (asteroid.body.y < -radius) asteroid.body.y = world.height + radius;
  if (asteroid.body.y > world.height + radius) asteroid.body.y = -radius;
}

export function updateAsteroids(asteroids: AsteroidEntity[], _deltaSeconds: number, world: WorldSize): void {
  for (const asteroid of asteroids) {
    const velocity = asteroid.body.body.velocity;
    asteroid.velocity = { x: velocity.x, y: velocity.y };
    wrapAsteroid(asteroid, world);
  }
}

export function createAsteroid(
  scene: Phaser.Scene,
  tier: AsteroidTier,
  position: Vector,
  velocity: Vector,
): AsteroidEntity {
  const config = ASTEROIDS[tier];
  const body = scene.matter.add.image(position.x, position.y, `phaser-asteroid-${tier}`) as MatterImage;
  body.setCircle(config.radius);
  body.setMass(config.mass);
  body.setFrictionAir(0);
  body.setBounce(1);
  body.setVelocity(velocity.x, velocity.y);
  return { body, hits: config.hits, tier, velocity };
}

export function splitAsteroid(scene: Phaser.Scene, asteroid: AsteroidEntity): AsteroidEntity[] {
  const config = ASTEROIDS[asteroid.tier];
  if (!config.child) return [];
  const childConfig = ASTEROIDS[config.child];
  const inherited = asteroid.velocity ?? { x: 0, y: 0 };
  const children: AsteroidEntity[] = [];
  for (let i = 0; i < config.splitCount; i += 1) {
    const angle = (Math.PI * 2 * i) / config.splitCount + Phaser.Math.FloatBetween(-0.35, 0.35);
    const speed = childConfig.speed * Phaser.Math.FloatBetween(0.8, 1.2);
    const spawnDistance = config.radius + childConfig.radius + 4;
    children.push(createAsteroid(
      scene,
      config.child,
      {
        x: asteroid.body.x + Math.cos(angle) * spawnDistance,
        y: asteroid.body.y + Math.sin(angle) * spawnDistance,
      },
      { x: inherited.x + Math.cos(angle) * speed, y: inherited.y + Math.sin(angle) * speed },
    ));
  }
  return children;
}

export function createAsteroidTextures(scene: Phaser.Scene): void {
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const [tier, config] of Object.entries(ASTEROIDS) as Array<[AsteroidTier, (typeof ASTEROIDS)[AsteroidTier]]>) {
    const diameter = config.radius * 2;
    graphics.clear();
    graphics.fillStyle(config.color, 1);
    graphics.fillCircle(config.radius, config.radius, config.radius);
    graphics.lineStyle(4, 0xffffff, 0.18);
    graphics.strokeCircle(config.radius, config.radius, config.radius - 2);
    graphics.generateTexture(`phaser-asteroid-${tier}`, diameter, diameter);
  }
  graphics.destroy();
}
