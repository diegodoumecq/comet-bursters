import {
  TRACTOR_BEAM_MAX_TARGET_SPEED,
  TRACTOR_BEAM_PULL,
  TRACTOR_BEAM_RANGE,
  type Player,
} from '@/constants';
import type { InputState } from '@/input/types';

const TRACTOR_BEAM_HALF_ANGLE = Math.PI / 6;
const TRACTOR_BEAM_GRAVITY_RADIUS = 140;
const TRACTOR_BEAM_GRAVITY_SOFTENING = 48;
const TRACTOR_BEAM_GRAVITY_MAX_ACCELERATION = 0.36;
const TRACTOR_BEAM_MIN_FORWARD_DISTANCE = 20;

export type TractorTarget = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export function isTractorActive(currentPlayer: Player, input: InputState): boolean {
  if (input.timeDilation.pressed) {
    return false;
  }

  const primaryTractor = currentPlayer.primaryWeapon === 'tractor' && input.fire.pressed;
  const secondaryTractor = currentPlayer.secondaryWeapon === 'tractor' && input.fireSpecial.pressed;
  return input.tractor.pressed || primaryTractor || secondaryTractor;
}

function getTractorBeamDirection(currentPlayer: Player): { x: number; y: number } {
  const angle = currentPlayer.turretAngle - Math.PI * 0.5;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function getTractorMuzzlePosition(
  currentPlayer: Player,
  direction = getTractorBeamDirection(currentPlayer),
): { x: number; y: number } {
  const radius = currentPlayer.getRadius();
  return {
    x: currentPlayer.x + direction.x * radius,
    y: currentPlayer.y + direction.y * radius,
  };
}

function getTractorBeamGeometry(currentPlayer: Player): {
  direction: { x: number; y: number };
  muzzle: { x: number; y: number };
  gravityPoint: { x: number; y: number };
} {
  const direction = getTractorBeamDirection(currentPlayer);
  const muzzle = getTractorMuzzlePosition(currentPlayer, direction);
  return {
    direction,
    muzzle,
    gravityPoint: {
      x: muzzle.x + direction.x * TRACTOR_BEAM_RANGE,
      y: muzzle.y + direction.y * TRACTOR_BEAM_RANGE,
    },
  };
}

function isInTractorBeam(
  currentPlayer: Player,
  target: { x: number; y: number },
  direction: { x: number; y: number },
): boolean {
  const muzzle = getTractorMuzzlePosition(currentPlayer, direction);
  const dx = target.x - muzzle.x;
  const dy = target.y - muzzle.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0 || distance > TRACTOR_BEAM_RANGE) {
    return false;
  }

  const forwardDistance = dx * direction.x + dy * direction.y;
  if (forwardDistance < TRACTOR_BEAM_MIN_FORWARD_DISTANCE) {
    return false;
  }

  const angle = Math.acos(Math.max(-1, Math.min(1, forwardDistance / distance)));
  return angle <= TRACTOR_BEAM_HALF_ANGLE;
}

function isNearTractorGravityPoint(
  target: { x: number; y: number },
  gravityPoint: { x: number; y: number },
): boolean {
  return Math.hypot(target.x - gravityPoint.x, target.y - gravityPoint.y) <=
    TRACTOR_BEAM_GRAVITY_RADIUS;
}

export function applyTractorBeamToTargets(
  currentPlayer: Player,
  input: InputState,
  targets: TractorTarget[],
  deltaScale = 1,
): void {
  if (!isTractorActive(currentPlayer, input) || currentPlayer.fuel <= 0 || currentPlayer.waitingToRespawn) {
    return;
  }

  const { direction, gravityPoint } = getTractorBeamGeometry(currentPlayer);
  for (const target of targets) {
    const affected =
      isInTractorBeam(currentPlayer, target, direction) ||
      isNearTractorGravityPoint(target, gravityPoint);

    if (affected) {
      const dx = gravityPoint.x - target.x;
      const dy = gravityPoint.y - target.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 0) {
        const softenedDistance = Math.max(distance, TRACTOR_BEAM_GRAVITY_SOFTENING);
        const gravityScale = Math.min(
          TRACTOR_BEAM_GRAVITY_MAX_ACCELERATION,
          (TRACTOR_BEAM_PULL * TRACTOR_BEAM_GRAVITY_RADIUS) / softenedDistance,
        );
        target.vx += (dx / distance) * gravityScale * deltaScale;
        target.vy += (dy / distance) * gravityScale * deltaScale;

        const speed = Math.hypot(target.vx, target.vy);
        if (speed > TRACTOR_BEAM_MAX_TARGET_SPEED) {
          target.vx = (target.vx / speed) * TRACTOR_BEAM_MAX_TARGET_SPEED;
          target.vy = (target.vy / speed) * TRACTOR_BEAM_MAX_TARGET_SPEED;
        }
      }
    }
  }
}

export function drawTractorBeam(
  ctx: CanvasRenderingContext2D,
  currentPlayer: Player,
  input: InputState,
): void {
  if (!isTractorActive(currentPlayer, input) || currentPlayer.waitingToRespawn || currentPlayer.fuel <= 0) {
    return;
  }

  ctx.save();
  const { direction, muzzle, gravityPoint } = getTractorBeamGeometry(currentPlayer);
  const beamAngle = Math.atan2(direction.y, direction.x);
  const edgeA = beamAngle - TRACTOR_BEAM_HALF_ANGLE;
  const edgeB = beamAngle + TRACTOR_BEAM_HALF_ANGLE;
  const endAX = muzzle.x + Math.cos(edgeA) * TRACTOR_BEAM_RANGE;
  const endAY = muzzle.y + Math.sin(edgeA) * TRACTOR_BEAM_RANGE;
  const endBX = muzzle.x + Math.cos(edgeB) * TRACTOR_BEAM_RANGE;
  const endBY = muzzle.y + Math.sin(edgeB) * TRACTOR_BEAM_RANGE;

  const beamGradient = ctx.createRadialGradient(
    muzzle.x,
    muzzle.y,
    0,
    muzzle.x,
    muzzle.y,
    TRACTOR_BEAM_RANGE,
  );
  beamGradient.addColorStop(0, 'rgba(210, 255, 255, 0.24)');
  beamGradient.addColorStop(0.42, 'rgba(100, 235, 255, 0.14)');
  beamGradient.addColorStop(1, 'rgba(100, 235, 255, 0.02)');
  ctx.fillStyle = beamGradient;
  ctx.beginPath();
  ctx.moveTo(muzzle.x, muzzle.y);
  ctx.lineTo(endAX, endAY);
  ctx.lineTo(endBX, endBY);
  ctx.lineTo(muzzle.x, muzzle.y);
  ctx.fill();

  ctx.strokeStyle = 'rgba(210, 255, 255, 0.28)';
  ctx.lineWidth = 2;
  for (let band = 0.28; band <= 1; band += 0.24) {
    ctx.beginPath();
    ctx.arc(muzzle.x, muzzle.y, TRACTOR_BEAM_RANGE * band, edgeA, edgeB);
    ctx.stroke();
  }

  const focusGradient = ctx.createRadialGradient(
    gravityPoint.x,
    gravityPoint.y,
    0,
    gravityPoint.x,
    gravityPoint.y,
    26,
  );
  focusGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  focusGradient.addColorStop(0.22, 'rgba(210, 255, 255, 0.7)');
  focusGradient.addColorStop(0.58, 'rgba(100, 235, 255, 0.24)');
  focusGradient.addColorStop(1, 'rgba(100, 235, 255, 0)');
  ctx.fillStyle = focusGradient;
  ctx.beginPath();
  ctx.arc(gravityPoint.x, gravityPoint.y, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(210, 255, 255, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(gravityPoint.x, gravityPoint.y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
