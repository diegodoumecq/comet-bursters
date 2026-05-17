import type { MatterArc, ProjectileEntity, ProjectileKind, Vector, WeaponKind } from '../model';
import { MAX_FUEL, addFuel, consumeTractorFuel } from './fuel';
import { RESPAWN_DELAY_MS } from './gameSession';
import { fireWeapon } from './weaponFire';

export class PlayerState {
  lastAim: Vector = { x: 0, y: -1 };
  lastShotAt: Record<ProjectileKind, number> = { blackHole: 0, pusher: 0, shotgun: 0, small: 0 };
  primaryWeapon: WeaponKind = 'small';
  secondaryWeapon: WeaponKind = 'pusher';
  fuel = MAX_FUEL;
  respawnAt = 0;
  invulnerableUntil = 0;
  shieldHitUntil = 0;

  fireWeapon(
    kind: WeaponKind,
    direction: Vector,
    now: number,
    shooterVelocity: Vector,
    createShape: (kind: ProjectileKind, angle: number) => MatterArc,
  ): { projectiles: ProjectileEntity[]; recoil: Vector } {
    const result = fireWeapon(kind, direction, now, this.fuel, this.lastShotAt, shooterVelocity);
    this.fuel = result.fuel;
    this.lastShotAt = result.lastShotAt;
    return {
      projectiles: result.shots.map((shot) => {
        const projectile = {
          absorbedFuel: 0,
          ageMs: 0,
          collapseStartedAt: null,
          createdAt: now,
          kind: shot.kind,
          lifetimeMs: shot.lifetimeMs,
          shape: createShape(shot.kind, shot.angle),
          velocity: shot.velocity,
        };
        projectile.shape.setVelocity(shot.velocity.x, shot.velocity.y);
        return projectile;
      }),
      recoil: result.recoil,
    };
  }

  updateAim(aim: Vector): void {
    if (Math.hypot(aim.x, aim.y) > 0) this.lastAim = aim;
  }

  assignWeapon(slot: 'primary' | 'secondary', weapon: WeaponKind): void {
    if (slot === 'primary') this.primaryWeapon = weapon;
    else this.secondaryWeapon = weapon;
  }

  isTractorActive(input: { firePrimary: boolean; fireSecondary: boolean; playerAlive: boolean; timeDilation: boolean }): boolean {
    return !input.timeDilation &&
      input.playerAlive &&
      ((this.primaryWeapon === 'tractor' && input.firePrimary) ||
        (this.secondaryWeapon === 'tractor' && input.fireSecondary));
  }

  setFuel(fuel: number): void {
    this.fuel = fuel;
  }

  spendTractorFuel(deltaSeconds: number, active: boolean): void {
    this.fuel = consumeTractorFuel(this.fuel, deltaSeconds, active);
  }

  collectFuel(amount: number): void {
    this.fuel = addFuel(this.fuel, amount);
  }

  applyCombatState(result: { fuel: number; shieldHitUntil: number }): void {
    this.fuel = result.fuel;
    this.shieldHitUntil = result.shieldHitUntil;
  }

  destroy(now: number): void {
    this.respawnAt = now + RESPAWN_DELAY_MS;
  }

  respawn(now: number): void {
    this.respawnAt = 0;
    this.fuel = MAX_FUEL;
    this.invulnerableUntil = now + 2200;
  }
}
