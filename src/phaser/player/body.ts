import Phaser from 'phaser';

import { getAsteroidCollisionMask } from '../combat/collisionCategories';
import type { MatterImage, Vector } from '../core/types';
import { SHIELD_RADIUS } from '../fuel/rules';
import type { PlayerState } from './state';

export class PlayerBody {
  readonly body: MatterImage;
  readonly shieldSensor: MatterImage;

  constructor(scene: Phaser.Scene, position: Vector, private readonly state: PlayerState) {
    this.body = scene.matter.add.image(position.x, position.y, 'phaser-ship') as MatterImage;
    this.body.setCircle(18);
    this.shieldSensor = scene.matter.add.image(position.x, position.y, '__DEFAULT') as MatterImage;
    this.shieldSensor.setCircle(SHIELD_RADIUS);
    this.shieldSensor.setSensor(true);
    this.shieldSensor.setVisible(false);
    this.shieldSensor.setIgnoreGravity(true);
    this.syncState();
  }

  syncState(): void {
    this.state.position = { x: this.body.x, y: this.body.y };
    this.state.velocity = { x: this.body.body.velocity.x, y: this.body.body.velocity.y };
    this.state.rotation = this.body.rotation;
  }

  setAsteroidCollisionEnabled(enabled: boolean): void {
    this.body.body.collisionFilter.mask = getAsteroidCollisionMask(enabled);
  }

  updateShieldSensor(active: boolean, asteroidCollisionEnabled = true): void {
    this.shieldSensor.setPosition(this.state.position.x, this.state.position.y);
    this.shieldSensor.setSensor(true);
    this.shieldSensor.setStatic(!active);
    this.shieldSensor.body.collisionFilter.mask = active
      ? getAsteroidCollisionMask(asteroidCollisionEnabled)
      : 0;
  }

  setPosition(position: Vector): void {
    this.body.setPosition(position.x, position.y);
    this.syncState();
  }

  setVelocity(velocity: Vector): void {
    this.body.setVelocity(velocity.x, velocity.y);
    this.syncState();
  }

  setRotation(rotation: number): void {
    this.body.setRotation(rotation);
    this.syncState();
  }

  setVisible(visible: boolean): void {
    this.body.setVisible(visible);
    this.state.visible = visible;
  }
}
