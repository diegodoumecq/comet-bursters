import type { Vector } from '../model';
import { FUELLESS_THRUST_SCALE, consumeThrustFuel } from './fuel';

export const PLAYER_ACCELERATION = 1600;
export const PLAYER_MAX_SPEED = 820;

export function updatePlayerMotion(
  velocity: Vector,
  move: Vector,
  fuel: number,
  deltaSeconds: number,
): { fuel: number; thrustScale: number; thrusting: boolean; velocity: Vector } {
  const thrusting = Math.hypot(move.x, move.y) > 0;
  const nextFuel = consumeThrustFuel(fuel, deltaSeconds, thrusting);
  const thrustScale = nextFuel > 0 ? 1 : FUELLESS_THRUST_SCALE;
  const nextVelocity = {
    x: velocity.x + move.x * PLAYER_ACCELERATION * thrustScale * deltaSeconds,
    y: velocity.y + move.y * PLAYER_ACCELERATION * thrustScale * deltaSeconds,
  };
  const speed = Math.hypot(nextVelocity.x, nextVelocity.y);
  if (speed > PLAYER_MAX_SPEED) {
    nextVelocity.x = (nextVelocity.x / speed) * PLAYER_MAX_SPEED;
    nextVelocity.y = (nextVelocity.y / speed) * PLAYER_MAX_SPEED;
  }
  return { fuel: nextFuel, thrustScale, thrusting, velocity: nextVelocity };
}
