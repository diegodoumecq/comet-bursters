import Phaser from 'phaser';

import type { MatterImage, Vector } from '../model';
import { FUELLESS_THRUST_SCALE, consumeThrustFuel } from './fuel';

export const PLAYER_ACCELERATION = 1600;
export const PLAYER_MAX_SPEED = 13.6667;

export function applyPlayerThrust(
  body: MatterImage,
  move: Vector,
  fuel: number,
  deltaSeconds: number,
): { fuel: number; thrustScale: number; thrusting: boolean } {
  const thrusting = Math.hypot(move.x, move.y) > 0;
  const nextFuel = consumeThrustFuel(fuel, deltaSeconds, thrusting);
  const thrustScale = nextFuel > 0 ? 1 : FUELLESS_THRUST_SCALE;
  if (thrusting) {
    const forceScale = PLAYER_ACCELERATION * body.body.mass * thrustScale * 0.000001;
    body.applyForce(new Phaser.Math.Vector2(
      move.x * forceScale,
      move.y * forceScale,
    ));
  }
  const velocity = body.body.velocity;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed > PLAYER_MAX_SPEED) {
    body.setVelocity(
      (velocity.x / speed) * PLAYER_MAX_SPEED,
      (velocity.y / speed) * PLAYER_MAX_SPEED,
    );
  }
  return { fuel: nextFuel, thrustScale, thrusting };
}
