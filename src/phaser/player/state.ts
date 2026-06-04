import type { Vector } from '../core/types';
import type { SpaceMembership } from '../dimensions/types';
import type { DischargedWeaponKind } from '../weapons/types';

export class PlayerState {
  position: Vector = { x: 0, y: 0 };
  velocity: Vector = { x: 0, y: 0 };
  rotation = 0;
  scale = 1;
  visible = true;
  lastAim: Vector = { x: 0, y: -1 };
  lastThrustMove: Vector = { x: 0, y: -1 };
  membership: SpaceMembership = { space: 'arcade' };
  lastShotAt: Record<DischargedWeaponKind, number> = {
    blackHole: 0,
    fuelGun: 0,
    inspectionProbe: 0,
    pusher: 0,
    shotgun: 0,
    small: 0,
  };
  respawnAt = 0;
  invulnerableUntil = 0;
  shieldHitUntil = 0;
  thrusting = false;

  updateAim(aim: Vector): void {
    if (Math.hypot(aim.x, aim.y) > 0) this.lastAim = aim;
  }

  updateThrust(move: Vector, thrusting: boolean): void {
    this.thrusting = thrusting;
    if (thrusting) this.lastThrustMove = move;
  }
}
