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
  input.body.setRotation(getShipFacingRotation(input.player.rotation, input.move));
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
  input.player.rotation = getShipFacingRotation(input.player.rotation, input.move);
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
  if (thrusting && canApplyThrust(body.body.velocity, move, tuning.maxSpeed)) {
    const forceScale = tuning.acceleration * body.body.mass * thrustScale * 0.000001;
    body.applyForce(new Phaser.Math.Vector2(move.x * forceScale, move.y * forceScale));
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
    const thrust = getAllowedThrust(player.velocity, move, acceleration, tuning.maxSpeed);
    player.velocity.x += thrust.x;
    player.velocity.y += thrust.y;
  }
  const frameScale = deltaSeconds * 60;
  player.position.x += player.velocity.x * frameScale;
  player.position.y += player.velocity.y * frameScale;
  return { fuel: nextFuel, thrustScale, thrusting };
}

function canApplyThrust(velocity: Vector, move: Vector, maxSpeed: number): boolean {
  const direction = normalizeMove(move);
  if (!direction) return false;
  return dot(velocity, direction) < maxSpeed;
}

function getAllowedThrust(
  velocity: Vector,
  move: Vector,
  acceleration: number,
  maxSpeed: number,
): Vector {
  const direction = normalizeMove(move);
  if (!direction) return { x: 0, y: 0 };
  const speedInThrustDirection = dot(velocity, direction);
  const allowedAcceleration = Math.max(
    0,
    Math.min(acceleration, maxSpeed - speedInThrustDirection),
  );
  return {
    x: direction.x * allowedAcceleration,
    y: direction.y * allowedAcceleration,
  };
}

function normalizeMove(move: Vector): Vector | null {
  const length = Math.hypot(move.x, move.y);
  if (length === 0) return null;
  return { x: move.x / length, y: move.y / length };
}

function dot(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

function getShipFacingRotation(currentRotation: number, thrustDirection: Vector): number {
  const direction = normalizeMove(thrustDirection);
  if (!direction) return currentRotation;
  return Math.atan2(direction.y, direction.x);
}
