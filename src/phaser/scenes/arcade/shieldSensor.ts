import Phaser from 'phaser';

import type { MatterImage, Vector } from '../../model';
import { SHIELD_RADIUS } from '../../services/fuel';

export function createShieldSensor(scene: Phaser.Scene, position: Vector): MatterImage {
  const sensor = scene.matter.add.image(position.x, position.y, '__DEFAULT') as MatterImage;
  sensor.setCircle(SHIELD_RADIUS);
  sensor.setSensor(true);
  sensor.setVisible(false);
  sensor.setIgnoreGravity(true);
  return sensor;
}

export function updateShieldSensor(sensor: MatterImage, position: Vector, active: boolean): void {
  sensor.setPosition(position.x, position.y);
  sensor.setSensor(true);
  sensor.setStatic(!active);
  sensor.body.collisionFilter.mask = active ? 0xffffffff : 0;
}
