import Phaser from 'phaser';

import type { AsteroidEntity, AsteroidTier, Vector, WorldSize } from '../model';

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
  mega: { child: 'big', color: 0xff6b6b, hits: 30, mass: 10, points: 10, radius: 100, speed: 45, splitCount: 3 },
  big: { child: 'medium', color: 0xffd93d, hits: 10, mass: 5, points: 20, radius: 70, speed: 80, splitCount: 2 },
  medium: { child: 'small', color: 0x6bcb77, hits: 3, mass: 2, points: 50, radius: 45, speed: 150, splitCount: 2 },
  small: { child: null, color: 0x4d96ff, hits: 1, mass: 1, points: 100, radius: 25, speed: 260, splitCount: 0 },
};

export function chooseWaveTier(wave: number): AsteroidTier {
  const roll = Math.random();
  const megaChance = Math.min(0.15, wave * 0.02);
  const bigChance = Math.min(0.4, wave * 0.05);
  if (wave >= 10 && roll < megaChance) return 'mega';
  if (wave >= 5 && roll < megaChance + bigChance) return 'big';
  if (wave >= 3 && roll < megaChance + bigChance + 0.3) return 'medium';
  return 'small';
}

export function resolveAsteroidCollisions(asteroids: AsteroidEntity[], world: WorldSize): void {
  for (let i = 0; i < asteroids.length; i += 1) {
    for (let j = i + 1; j < asteroids.length; j += 1) {
      resolvePair(asteroids[i], asteroids[j], world);
    }
  }
}

export function wrapAsteroid(asteroid: AsteroidEntity, world: WorldSize): void {
  const radius = ASTEROIDS[asteroid.tier].radius;
  if (asteroid.body.x < -radius) asteroid.body.x = world.width + radius;
  if (asteroid.body.x > world.width + radius) asteroid.body.x = -radius;
  if (asteroid.body.y < -radius) asteroid.body.y = world.height + radius;
  if (asteroid.body.y > world.height + radius) asteroid.body.y = -radius;
}

function resolvePair(left: AsteroidEntity, right: AsteroidEntity, world: WorldSize): void {
  const leftConfig = ASTEROIDS[left.tier];
  const rightConfig = ASTEROIDS[right.tier];
  let dx = right.body.x - left.body.x;
  let dy = right.body.y - left.body.y;
  if (dx > world.width * 0.5) dx -= world.width;
  if (dx < -world.width * 0.5) dx += world.width;
  if (dy > world.height * 0.5) dy -= world.height;
  if (dy < -world.height * 0.5) dy += world.height;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const minDistance = leftConfig.radius + rightConfig.radius;
  if (distance >= minDistance) return;
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  const totalMass = leftConfig.mass + rightConfig.mass;
  left.body.x -= nx * overlap * (rightConfig.mass / totalMass);
  left.body.y -= ny * overlap * (rightConfig.mass / totalMass);
  right.body.x += nx * overlap * (leftConfig.mass / totalMass);
  right.body.y += ny * overlap * (leftConfig.mass / totalMass);
  const leftVelocity = left.velocity ?? { x: 0, y: 0 };
  const rightVelocity = right.velocity ?? { x: 0, y: 0 };
  const relativeX = rightVelocity.x - leftVelocity.x;
  const relativeY = rightVelocity.y - leftVelocity.y;
  const velocityAlongNormal = relativeX * nx + relativeY * ny;
  if (velocityAlongNormal > 0) return;
  const impulse = (-1.05 * velocityAlongNormal) / (1 / leftConfig.mass + 1 / rightConfig.mass);
  leftVelocity.x -= (impulse / leftConfig.mass) * nx;
  leftVelocity.y -= (impulse / leftConfig.mass) * ny;
  rightVelocity.x += (impulse / rightConfig.mass) * nx;
  rightVelocity.y += (impulse / rightConfig.mass) * ny;
  left.velocity = leftVelocity;
  right.velocity = rightVelocity;
}

export function createAsteroid(
  scene: Phaser.Scene,
  tier: AsteroidTier,
  position: Vector,
  velocity: Vector,
): AsteroidEntity {
  const config = ASTEROIDS[tier];
  const body = scene.matter.add.image(position.x, position.y, `phaser-asteroid-${tier}`);
  body.setStatic(true);
  body.setCircle(config.radius);
  return { body, hits: config.hits, tier, velocity };
}

export function createWaveAsteroids(scene: Phaser.Scene, wave: number, world: WorldSize): AsteroidEntity[] {
  const asteroids: AsteroidEntity[] = [];
  for (let i = 0; i < wave + 2; i += 1) {
    const tier = chooseWaveTier(wave);
    const config = ASTEROIDS[tier];
    const side = Phaser.Math.Between(0, 3);
    const position = side === 0 ? { x: -config.radius, y: Math.random() * world.height } :
      side === 1 ? { x: world.width + config.radius, y: Math.random() * world.height } :
        side === 2 ? { x: Math.random() * world.width, y: -config.radius } :
          { x: Math.random() * world.width, y: world.height + config.radius };
    const centerAngle = Math.atan2(world.height * 0.5 - position.y, world.width * 0.5 - position.x);
    const angle = centerAngle + Phaser.Math.FloatBetween(-Math.PI * 0.5, Math.PI * 0.5);
    const speed = config.speed * Phaser.Math.FloatBetween(0.8, 1.2);
    asteroids.push(createAsteroid(scene, tier, position, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }));
  }
  return asteroids;
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
