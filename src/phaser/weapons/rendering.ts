import type Phaser from 'phaser';

import type { MatterArc, Vector } from '../core/types';
import { PROJECTILES } from './config';
import type { ProjectileKind } from './types';

export function createProjectileShape(
  scene: Phaser.Scene,
  origin: Vector,
  kind: ProjectileKind,
  angle: number,
  velocity?: Vector,
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
    syncProjectileVisual(matterShape, kind, velocity, angle);
    matterShape.setStrokeStyle(1.5, 0xecfeff);
  } else if (kind === 'pusher') {
    syncProjectileVisual(matterShape, kind, velocity, angle);
  } else if (kind === 'small') {
    syncProjectileVisual(matterShape, kind, velocity, angle);
  } else {
    syncProjectileVisual(matterShape, kind, velocity, angle);
  }
  return matterShape;
}

export function syncProjectileVisual(
  shape: MatterArc,
  kind: ProjectileKind,
  velocity: Vector | undefined,
  fallbackAngle: number,
): void {
  if (kind === 'blackHole') return;
  const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
  const angle = velocity && speed > 0 ? Math.atan2(velocity.y, velocity.x) : fallbackAngle;
  const scale = getProjectileVisualScale(kind, speed);
  shape.setScale(scale.x, scale.y).setRotation(angle);
}

export function getProjectileVisualScale(kind: ProjectileKind, speed: number): Vector {
  const baseScale = getProjectileBaseVisualScale(kind);
  const baseSpeed = PROJECTILES[kind].speed;
  const speedScale = baseSpeed > 0 ? clamp(speed / baseSpeed, 0.35, 2.25) : 1;
  return {
    x: baseScale.x * speedScale,
    y: baseScale.y,
  };
}

function getProjectileBaseVisualScale(kind: ProjectileKind): Vector {
  if (kind === 'inspectionProbe') return { x: 2.2, y: 0.72 };
  if (kind === 'pusher') return { x: 2.8, y: 0.72 };
  if (kind === 'small') return { x: 2.1, y: 0.7 };
  if (kind === 'shotgun') return { x: 1.8, y: 0.72 };
  return { x: 1, y: 1 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
