import Phaser from 'phaser';

import type { AsteroidEntity } from '../asteroids/types';
import type { AsteroidBodies } from '../asteroids/bodies';
import type { Vector } from '../core/types';
import { normalize } from '../world/geometry';

const RANGE = 360;
const HALF_ANGLE = Math.PI / 6;
const FOCUS_RADIUS = 120;

export function getTractorFocus(origin: Vector, aim: Vector): Vector {
  const direction = normalize(aim);
  return { x: origin.x + direction.x * RANGE, y: origin.y + direction.y * RANGE };
}

export function applyTractorBeam(
  origin: Vector,
  aim: Vector,
  asteroids: AsteroidEntity[],
  runtime: AsteroidBodies,
  enabled: boolean,
): void {
  if (!enabled) return;
  const direction = normalize(aim);
  const focus = getTractorFocus(origin, aim);
  for (const asteroid of asteroids) {
    const dx = asteroid.position.x - origin.x;
    const dy = asteroid.position.y - origin.y;
    const distance = Math.hypot(dx, dy);
    const forward = dx * direction.x + dy * direction.y;
    const angle = distance > 0 ? Math.acos(Math.max(-1, Math.min(1, forward / distance))) : Infinity;
    const focusDistance = Math.hypot(focus.x - asteroid.position.x, focus.y - asteroid.position.y);
    const affected = (distance <= RANGE && forward > 16 && angle <= HALF_ANGLE) || focusDistance <= FOCUS_RADIUS;
    if (affected && focusDistance > 0) {
      const softened = Math.max(42, focusDistance);
      runtime.get(asteroid).applyForce(
        new Phaser.Math.Vector2(
          ((focus.x - asteroid.position.x) / focusDistance) * (0.018 / softened),
          ((focus.y - asteroid.position.y) / focusDistance) * (0.018 / softened),
        ),
      );
    }
  }
}

export function drawTractorBeam(
  graphics: Phaser.GameObjects.Graphics,
  origin: Vector,
  aim: Vector,
  enabled: boolean,
): void {
  graphics.clear();
  if (!enabled) return;
  const direction = normalize(aim);
  const angle = Math.atan2(direction.y, direction.x);
  const focus = getTractorFocus(origin, aim);
  graphics.fillStyle(0x67e8f9, 0.16);
  graphics.beginPath();
  graphics.moveTo(origin.x, origin.y);
  graphics.lineTo(origin.x + Math.cos(angle - HALF_ANGLE) * RANGE, origin.y + Math.sin(angle - HALF_ANGLE) * RANGE);
  graphics.lineTo(origin.x + Math.cos(angle + HALF_ANGLE) * RANGE, origin.y + Math.sin(angle + HALF_ANGLE) * RANGE);
  graphics.closePath();
  graphics.fillPath();
  graphics.fillStyle(0x67e8f9, 0.28);
  graphics.fillCircle(focus.x, focus.y, FOCUS_RADIUS);
}
