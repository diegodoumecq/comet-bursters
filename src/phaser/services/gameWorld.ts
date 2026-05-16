import type Phaser from 'phaser';

import type { AsteroidEntity, FuelBlobEntity, ParticleEntity, ProjectileEntity, ProjectileKind, Vector, WeaponKind } from '../model';
import { MAX_FUEL } from './fuel';
import { addFuel, consumeTractorFuel } from './fuel';
import { getNextWaveState, RESPAWN_DELAY_MS } from './gameSession';
import { updatePlayerMotion } from './playerMotion';
import { fireWeapon } from './weaponFire';

export class GameWorld {
  asteroids: AsteroidEntity[] = [];
  fuelBlobs: FuelBlobEntity[] = [];
  particles: ParticleEntity[] = [];
  projectiles: ProjectileEntity[] = [];
  playerVelocity: Vector = { x: 0, y: 0 };
  lastAim: Vector = { x: 0, y: -1 };
  lastShotAt: Record<ProjectileKind, number> = { blackHole: 0, pusher: 0, shotgun: 0, small: 0 };
  primaryWeapon: WeaponKind = 'small';
  secondaryWeapon: WeaponKind = 'pusher';
  fuel = MAX_FUEL;
  wave: number;
  score = 0;
  lives = 3;
  respawnAt = 0;
  invulnerableUntil = 0;
  waveClearAt = 0;
  shieldHitUntil = 0;

  constructor(startingWave: number) {
    this.wave = startingWave;
  }

  fireWeapon(
    kind: WeaponKind,
    direction: Vector,
    now: number,
    createShape: (kind: ProjectileKind, angle: number) => Phaser.GameObjects.Arc,
  ): void {
    const result = fireWeapon(kind, direction, now, this.fuel, this.lastShotAt, this.playerVelocity);
    this.fuel = result.fuel;
    this.lastShotAt = result.lastShotAt;
    for (const shot of result.shots) {
      this.projectiles.push({
        absorbedFuel: 0,
        collapseStartedAt: null,
        createdAt: now,
        kind: shot.kind,
        lifetimeMs: shot.lifetimeMs,
        shape: createShape(shot.kind, shot.angle),
        velocity: shot.velocity,
      });
    }
    this.playerVelocity.x += result.recoil.x;
    this.playerVelocity.y += result.recoil.y;
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

  applyPlayerMotion(move: Vector, deltaSeconds: number): ReturnType<typeof updatePlayerMotion> {
    const motion = updatePlayerMotion(this.playerVelocity, move, this.fuel, deltaSeconds);
    this.fuel = motion.fuel;
    this.playerVelocity = motion.velocity;
    return motion;
  }

  spendTractorFuel(deltaSeconds: number, active: boolean): void {
    this.fuel = consumeTractorFuel(this.fuel, deltaSeconds, active);
  }

  awardAsteroidScore(points: number): void {
    this.score += points * this.lives;
  }

  addAsteroids(asteroids: AsteroidEntity[]): void {
    this.asteroids.push(...asteroids);
  }

  addFuelBlobs(blobs: FuelBlobEntity[]): void {
    this.fuelBlobs.push(...blobs);
  }

  addParticles(particles: ParticleEntity[]): void {
    this.particles.push(...particles);
  }

  collectFuel(amount: number): void {
    this.fuel = addFuel(this.fuel, amount);
  }

  applyPlayerCombatState(result: { fuel: number; playerVelocity: Vector; shieldHitUntil: number }): void {
    this.fuel = result.fuel;
    this.playerVelocity = result.playerVelocity;
    this.shieldHitUntil = result.shieldHitUntil;
  }

  destroyPlayer(now: number): void {
    this.lives -= 1;
    this.respawnAt = now + RESPAWN_DELAY_MS;
  }

  respawn(now: number): void {
    this.respawnAt = 0;
    this.fuel = MAX_FUEL;
    this.invulnerableUntil = now + 2200;
  }

  shouldRespawn(now: number): boolean {
    return this.lives > 0 && this.respawnAt !== 0 && now >= this.respawnAt;
  }

  advanceWave(now: number): boolean {
    const state = getNextWaveState(this.asteroids.length, this.wave, this.waveClearAt, now);
    this.wave = state.wave;
    this.waveClearAt = state.waveClearAt;
    return state.shouldSpawn;
  }

  removeProjectile(projectile: ProjectileEntity): void {
    const index = this.projectiles.indexOf(projectile);
    if (index !== -1) this.projectiles.splice(index, 1);
  }

  removeAsteroid(asteroid: AsteroidEntity): void {
    const index = this.asteroids.indexOf(asteroid);
    if (index !== -1) this.asteroids.splice(index, 1);
  }

  removeFuelBlob(blob: FuelBlobEntity): void {
    const index = this.fuelBlobs.indexOf(blob);
    if (index !== -1) this.fuelBlobs.splice(index, 1);
  }

  removeParticle(particle: ParticleEntity): void {
    const index = this.particles.indexOf(particle);
    if (index !== -1) this.particles.splice(index, 1);
  }
}
