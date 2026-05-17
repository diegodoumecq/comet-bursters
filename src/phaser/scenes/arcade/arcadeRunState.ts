import type { MatterArc, ProjectileEntity, ProjectileKind, Vector, WeaponKind } from '../../model';
import { RESPAWN_DELAY_MS, getNextWaveState } from '../../services/gameSession';
import { GameWorld } from '../../services/gameWorld';
import { PlayerRuntimeState } from '../../services/playerRuntimeState';
import { allowsWeapon, type SceneWeaponPolicy } from '../../services/sceneWeaponPolicy';
import { ShipState } from '../../services/shipState';
import { consumeTractorFuel } from '../../services/fuel';
import { fireWeapon } from '../../services/weaponFire';

export class ArcadeRunState {
  readonly world = new GameWorld();
  readonly ship = new ShipState();
  readonly player = new PlayerRuntimeState();
  wave: number;
  score = 0;
  lives = 3;
  waveClearAt = 0;

  constructor(startingWave: number) {
    this.wave = startingWave;
  }

  get playerAlive(): boolean {
    return this.player.respawnAt === 0 && this.lives > 0;
  }

  fireWeapon(
    policy: SceneWeaponPolicy,
    kind: WeaponKind,
    direction: Vector,
    now: number,
    shooterVelocity: Vector,
    createShape: (kind: ProjectileKind, angle: number) => MatterArc,
  ): { projectiles: ProjectileEntity[]; recoil: Vector } {
    if (!allowsWeapon(policy, kind)) return { projectiles: [], recoil: { x: 0, y: 0 } };
    const result = fireWeapon(kind, direction, now, this.ship.fuel, this.player.lastShotAt, shooterVelocity);
    this.ship.setFuel(result.fuel);
    this.player.lastShotAt = result.lastShotAt;
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

  isTractorActive(policy: SceneWeaponPolicy, input: { firePrimary: boolean; fireSecondary: boolean; playerAlive: boolean; timeDilation: boolean }): boolean {
    return allowsWeapon(policy, 'tractor') &&
      !input.timeDilation &&
      input.playerAlive &&
      ((this.ship.primaryWeapon === 'tractor' && input.firePrimary) ||
        (this.ship.secondaryWeapon === 'tractor' && input.fireSecondary));
  }

  spendTractorFuel(deltaSeconds: number, active: boolean): void {
    this.ship.setFuel(consumeTractorFuel(this.ship.fuel, deltaSeconds, active));
  }

  awardAsteroidScore(points: number): void {
    this.score += points * this.lives;
  }

  destroyPlayer(now: number): void {
    this.lives -= 1;
    this.player.respawnAt = now + RESPAWN_DELAY_MS;
  }

  shouldRespawn(now: number): boolean {
    return this.lives > 0 && this.player.respawnAt !== 0 && now >= this.player.respawnAt;
  }

  respawn(now: number): void {
    this.player.respawnAt = 0;
    this.ship.resetFuel();
    this.player.invulnerableUntil = now + 2200;
  }

  advanceWave(now: number): boolean {
    const state = getNextWaveState(this.world.asteroids.length, this.wave, this.waveClearAt, now);
    this.wave = state.wave;
    this.waveClearAt = state.waveClearAt;
    return state.shouldSpawn;
  }
}
