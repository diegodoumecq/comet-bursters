import Phaser from 'phaser';

import type { ProjectileKind, Vector } from '../model';
import { PROJECTILES } from './weapons';

export function createProjectileShape(
  scene: Phaser.Scene,
  origin: Vector,
  kind: ProjectileKind,
  angle: number,
): Phaser.GameObjects.Arc {
  const spec = PROJECTILES[kind];
  const fill = kind === 'blackHole'
    ? 0x000000
    : kind === 'pusher'
      ? 0x67e8f9
      : kind === 'shotgun'
        ? 0xffd166
        : 0xffffff;
  const shape = scene.add.circle(origin.x, origin.y, spec.radius, fill);
  if (kind === 'blackHole') {
    shape.setStrokeStyle(2, 0xffffff);
  } else if (kind === 'pusher') {
    shape.setScale(2.8, 0.72).setRotation(angle);
  } else if (kind === 'small') {
    shape.setScale(2.1, 0.7).setRotation(angle);
  }
  return shape;
}
