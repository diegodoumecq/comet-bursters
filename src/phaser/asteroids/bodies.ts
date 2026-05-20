import Phaser from 'phaser';

import type { MatterImage } from '../core/types';
import { ASTEROIDS } from './logic';
import { ASTEROID_TEXTURES } from './textures';
import type { AsteroidEntity } from './types';

const SPLIT_GROUP_MULTIPLIER = -1;

export class AsteroidBodies {
  private readonly bodies = new Map<number, MatterImage>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(asteroid: AsteroidEntity): MatterImage {
    const config = ASTEROIDS[asteroid.tier];
    const body = this.scene.matter.add.image(
      asteroid.position.x,
      asteroid.position.y,
      ASTEROID_TEXTURES[asteroid.tier][asteroid.visualVariant],
    ) as MatterImage;
    body.setCircle(config.collisionRadius);
    body.setMass(config.mass);
    body.setFrictionAir(0);
    body.setBounce(1);
    body.setVelocity(asteroid.velocity.x, asteroid.velocity.y);
    this.bodies.set(asteroid.id, body);
    this.syncCollisionFilter(asteroid);
    return body;
  }

  get(asteroid: AsteroidEntity): MatterImage {
    const body = this.bodies.get(asteroid.id);
    if (!body) throw new Error(`Missing asteroid body ${asteroid.id}`);
    return body;
  }

  remove(asteroid: AsteroidEntity): void {
    this.get(asteroid).destroy();
    this.bodies.delete(asteroid.id);
  }

  sync(asteroid: AsteroidEntity): void {
    const body = this.get(asteroid);
    asteroid.position = { x: body.x, y: body.y };
    asteroid.velocity = { x: body.body.velocity.x, y: body.body.velocity.y };
  }

  syncAll(asteroids: AsteroidEntity[]): void {
    for (const asteroid of asteroids) this.sync(asteroid);
  }

  syncCollisionFilter(asteroid: AsteroidEntity): void {
    const body = this.get(asteroid);
    body.body.collisionFilter.group = asteroid.splitGroupId
      ? asteroid.splitGroupId * SPLIT_GROUP_MULTIPLIER
      : 0;
  }
}
