import Phaser from 'phaser';

import type { MatterImage, Vector, WorldSize } from '../core/types';
import { FUELLESS_THRUST_SCALE, consumeThrustFuel } from '../fuel/rules';
import type { PlayerState } from './state';
import type { ShipState } from './shipState';
import type { PlayerBody } from './body';
import { wrapPoint } from '../world/geometry';

export const PLAYER_ACCELERATION = 360;
export const PLAYER_MAX_SPEED = 25;

export function updatePlayerMotion(input: {
  body: PlayerBody;
  deltaSeconds: number;
  move: Vector;
  player: PlayerState;
  ship: ShipState;
  world: WorldSize;
  wrap?: boolean;
}): { thrustScale: number; thrusting: boolean } {
  if (Math.hypot(input.move.x, input.move.y) > 0) {
    input.body.setRotation(Math.atan2(input.move.y, input.move.x) + Math.PI * 0.5);
  }
  const motion = applyPlayerThrust(input.body.body, input.move, input.ship.fuel, input.deltaSeconds);
  input.ship.setFuel(motion.fuel);
  input.player.updateThrust(input.move, motion.thrusting);
  if (input.wrap ?? true) wrapPoint(input.body.body, input.world);
  input.body.syncState();
  return motion;
}

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
    body.applyForce(new Phaser.Math.Vector2(move.x * forceScale, move.y * forceScale));
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
