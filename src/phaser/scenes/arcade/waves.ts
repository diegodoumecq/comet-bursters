import Phaser from 'phaser';

import type { AsteroidEntity, AsteroidTier, WorldSize } from '../../model';
import { ASTEROIDS, createAsteroid } from '../../services/asteroids';

export function createWaveAsteroids(scene: Phaser.Scene, wave: number, world: WorldSize): AsteroidEntity[] {
  const asteroids: AsteroidEntity[] = [];
  for (let index = 0; index < wave + 2; index += 1) {
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

function chooseWaveTier(wave: number): AsteroidTier {
  const roll = Math.random();
  const megaChance = Math.min(0.15, wave * 0.02);
  const bigChance = Math.min(0.4, wave * 0.05);
  if (wave >= 10 && roll < megaChance) return 'mega';
  if (wave >= 5 && roll < megaChance + bigChance) return 'big';
  if (wave >= 3 && roll < megaChance + bigChance + 0.3) return 'medium';
  return 'small';
}
