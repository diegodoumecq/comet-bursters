import Phaser from 'phaser';

import type { MatterImage, Vector, WorldSize } from '../core/types';
import { consumeThrustFuel, FUELLESS_THRUST_SCALE } from '../fuel/rules';
import { wrapPoint } from '../world/geometry';
import type { PlayerBody } from './body';
import { PLAYER_ACCELERATION, PLAYER_MAX_SPEED } from './config';
import type { ShipState } from './shipState';
import type { PlayerState } from './state';

export type PlayerMotionTuning = {
  acceleration: number;
  maxSpeed: number;
};

const DEFAULT_PLAYER_MOTION_TUNING: PlayerMotionTuning = {
  acceleration: PLAYER_ACCELERATION,
  maxSpeed: PLAYER_MAX_SPEED,
};

export function updatePlayerMotion(input: {
  body: PlayerBody;
  deltaSeconds: number;
  move: Vector;
  player: PlayerState;
  ship: ShipState;
  tuning?: PlayerMotionTuning;
  world: WorldSize;
  wrap?: boolean;
}): { thrustScale: number; thrusting: boolean } {
  if (Math.hypot(input.move.x, input.move.y) > 0) {
    input.body.setRotation(Math.atan2(input.move.y, input.move.x));
  }
  const motion = applyPlayerThrust(
    input.body.body,
    input.move,
    input.ship.fuel,
    input.deltaSeconds,
    input.tuning,
  );
  input.ship.setFuel(motion.fuel);
  input.player.updateThrust(input.move, motion.thrusting);
  if (input.wrap ?? true) wrapPoint(input.body.body, input.world);
  input.body.syncState();
  return motion;
}

export function updatePlayerStateMotion(input: {
  deltaSeconds: number;
  move: Vector;
  player: PlayerState;
  ship: ShipState;
  tuning?: PlayerMotionTuning;
  world: WorldSize;
  wrap?: boolean;
}): { thrustScale: number; thrusting: boolean } {
  if (Math.hypot(input.move.x, input.move.y) > 0) {
    input.player.rotation = Math.atan2(input.move.y, input.move.x);
  }
  const motion = applyPlayerStateThrust(
    input.player,
    input.move,
    input.ship.fuel,
    input.deltaSeconds,
    input.tuning,
  );
  input.ship.setFuel(motion.fuel);
  input.player.updateThrust(input.move, motion.thrusting);
  if (input.wrap ?? true) wrapPoint(input.player.position, input.world);
  return motion;
}

export function applyPlayerThrust(
  body: MatterImage,
  move: Vector,
  fuel: number,
  deltaSeconds: number,
  tuning = DEFAULT_PLAYER_MOTION_TUNING,
): { fuel: number; thrustScale: number; thrusting: boolean } {
  const thrusting = Math.hypot(move.x, move.y) > 0;
  const nextFuel = consumeThrustFuel(fuel, deltaSeconds, thrusting);
  const thrustScale = nextFuel > 0 ? 1 : FUELLESS_THRUST_SCALE;
  if (thrusting) {
    const forceScale = tuning.acceleration * body.body.mass * thrustScale * 0.000001;
    body.applyForce(new Phaser.Math.Vector2(move.x * forceScale, move.y * forceScale));
  }
  const velocity = body.body.velocity;
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed > tuning.maxSpeed) {
    body.setVelocity(
      (velocity.x / speed) * tuning.maxSpeed,
      (velocity.y / speed) * tuning.maxSpeed,
    );
  }
  return { fuel: nextFuel, thrustScale, thrusting };
}

export function applyPlayerStateThrust(
  player: PlayerState,
  move: Vector,
  fuel: number,
  deltaSeconds: number,
  tuning = DEFAULT_PLAYER_MOTION_TUNING,
): { fuel: number; thrustScale: number; thrusting: boolean } {
  const thrusting = Math.hypot(move.x, move.y) > 0;
  const nextFuel = consumeThrustFuel(fuel, deltaSeconds, thrusting);
  const thrustScale = nextFuel > 0 ? 1 : FUELLESS_THRUST_SCALE;
  if (thrusting) {
    const frameScale = deltaSeconds * 60;
    const acceleration = tuning.acceleration * thrustScale * 0.000001 * frameScale;
    player.velocity.x += move.x * acceleration;
    player.velocity.y += move.y * acceleration;
  }
  const speed = Math.hypot(player.velocity.x, player.velocity.y);
  if (speed > tuning.maxSpeed) {
    player.velocity.x = (player.velocity.x / speed) * tuning.maxSpeed;
    player.velocity.y = (player.velocity.y / speed) * tuning.maxSpeed;
  }
  const frameScale = deltaSeconds * 60;
  player.position.x += player.velocity.x * frameScale;
  player.position.y += player.velocity.y * frameScale;
  return { fuel: nextFuel, thrustScale, thrusting };
}
