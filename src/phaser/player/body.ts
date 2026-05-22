import Phaser from 'phaser';

import { ALL_COLLISION_CATEGORIES, getAsteroidCollisionMask } from '../combat/collisionCategories';
import type { MatterImage, Vector } from '../core/types';
import { SHIELD_RADIUS } from '../fuel/rules';
import { setPlayerCollisionCircle } from './collision';
import type { PlayerState } from './state';

export class PlayerBody {
  readonly body: MatterImage;
  readonly shieldSensor: MatterImage;
  private scale = 1;

  constructor(scene: Phaser.Scene, position: Vector, private readonly state: PlayerState) {
    this.body = scene.matter.add.image(position.x, position.y, 'phaser-ship') as MatterImage;
    setPlayerCollisionCircle(this.body, this.scale);
    this.body.setPosition(position.x, position.y);
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
    this.state.scale = this.scale;
  }

  setAsteroidCollisionEnabled(enabled: boolean): void {
    this.body.body.collisionFilter.mask = getAsteroidCollisionMask(enabled);
  }

  setCollisionEnabled(enabled: boolean): void {
    this.body.body.collisionFilter.mask = enabled ? ALL_COLLISION_CATEGORIES : 0;
  }

  updateShieldSensor(active: boolean, asteroidCollisionEnabled = true): void {
    this.shieldSensor.setPosition(this.state.position.x, this.state.position.y);
    this.shieldSensor.setSensor(true);
    this.shieldSensor.setStatic(!active);
    this.shieldSensor.body.collisionFilter.mask = active
      ? getAsteroidCollisionMask(asteroidCollisionEnabled)
      : 0;
  }

  setScale(scale: number): void {
    this.scale = scale;
    const bodyPosition = { x: this.body.x, y: this.body.y };
    const bodyVelocity = { x: this.body.body.velocity.x, y: this.body.body.velocity.y };
    const bodyRotation = this.body.rotation;
    const shieldPosition = { x: this.shieldSensor.x, y: this.shieldSensor.y };
    this.body.setScale(scale);
    this.resizePlayerCircle(this.body, scale);
    this.resizeCircle(this.shieldSensor, SHIELD_RADIUS * scale);
    this.body.setPosition(bodyPosition.x, bodyPosition.y);
    this.body.setRotation(bodyRotation);
    this.body.setVelocity(bodyVelocity.x, bodyVelocity.y);
    this.shieldSensor.setPosition(shieldPosition.x, shieldPosition.y);
    this.shieldSensor.setVisible(false);
    this.syncState();
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

  private resizeCircle(target: MatterImage, radius: number): void {
    this.applyCircle(target, () => target.setCircle(radius));
  }

  private resizePlayerCircle(target: MatterImage, scale: number): void {
    this.applyCircle(target, () => setPlayerCollisionCircle(target, scale));
  }

  private applyCircle(target: MatterImage, applyShape: () => void): void {
    const filter = { ...target.body.collisionFilter };
    const friction = target.body.friction;
    const frictionAir = target.body.frictionAir;
    const frictionStatic = target.body.frictionStatic;
    const isSensor = target.body.isSensor;
    const isStatic = target.body.isStatic;
    const mass = target.body.mass;
    applyShape();
    target.setSensor(isSensor);
    target.setStatic(isStatic);
    target.setFriction(friction, frictionAir, frictionStatic);
    target.setMass(mass);
    target.body.collisionFilter.category = filter.category;
    target.body.collisionFilter.mask = filter.mask;
    target.body.collisionFilter.group = filter.group;
  }
}
