import type { ProjectileKind, Vector } from '../model';

export class PlayerRuntimeState {
  lastAim: Vector = { x: 0, y: -1 };
  lastShotAt: Record<ProjectileKind, number> = { blackHole: 0, pusher: 0, shotgun: 0, small: 0 };
  respawnAt = 0;
  invulnerableUntil = 0;
  shieldHitUntil = 0;

  updateAim(aim: Vector): void {
    if (Math.hypot(aim.x, aim.y) > 0) this.lastAim = aim;
  }
}
