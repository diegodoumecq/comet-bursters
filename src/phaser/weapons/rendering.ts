import Phaser from 'phaser';

import type { MatterArc, Vector } from '../core/types';
import { PROJECTILES } from './config';
import type { ProjectileKind } from './types';

export function createProjectileShape(
  scene: Phaser.Scene,
  origin: Vector,
  kind: ProjectileKind,
  angle: number,
): MatterArc {
  const spec = PROJECTILES[kind];
  const fill =
    kind === 'blackHole'
      ? 0x000000
      : kind === 'inspectionProbe'
        ? 0x67e8f9
        : kind === 'pusher'
          ? 0x67e8f9
          : kind === 'shotgun'
            ? 0xffd166
            : 0xffffff;
  const shape = scene.add.circle(origin.x, origin.y, spec.radius, fill);
  scene.matter.add.gameObject(shape, {
    circleRadius: spec.radius,
    isSensor: true,
  });
  const matterShape = shape as MatterArc;
  if (kind === 'blackHole') {
    matterShape.setVisible(false);
  } else if (kind === 'inspectionProbe') {
    matterShape.setScale(2.2, 0.72).setRotation(angle).setStrokeStyle(1.5, 0xecfeff);
  } else if (kind === 'pusher') {
    matterShape.setScale(2.8, 0.72).setRotation(angle);
  } else if (kind === 'small') {
    matterShape.setScale(2.1, 0.7).setRotation(angle);
  }
  return matterShape;
}
