import Phaser from 'phaser';

import type { AsteroidEntity } from '../asteroids/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import type { ProjectileEntity } from '../projectiles/types';
import type { Vector, WorldSize } from '../core/types';
import { ActionReader } from '../input/actions';
import { ASTEROIDS, wrapAsteroid } from '../asteroids/logic';
import { destroyAsteroidWithWeapon } from '../combat/asteroidDestruction';
import { updateBlackHoles } from '../projectiles/blackHoles';
import { resolvePlayerCombat, resolveProjectileContactCombat } from '../combat/asteroids';
import { createAsteroidExplosion, createExplosionBurst, createShipExplosion, createThrusterParticles, type EffectResult } from '../combat/effects';
import { MAX_FUEL } from '../fuel/rules';
import { spawnFuelBlobs, updateFuelBlobs } from '../fuel/blobLogic';
import { chooseSafePlayerPosition } from './arcade/runFlow';
import { MatterContacts } from '../combat/matterContacts';
import { updateParticles } from '../particles/logic';
import { updatePlayerMotion } from '../player/motion';
import { updateProjectiles } from '../projectiles/logic';
import { getTimeScale } from '../core/time';
import { applyTractorBeam } from '../weapons/tractorBeam';
import { normalize } from '../world/geometry';
import { getStartingWave } from '../runtime/startup';
import { ArcadeRenderer } from './arcade/ArcadeRenderer';
import { createArcadeTextures } from './arcade/arcadeVisuals';
import { ArcadeRunState } from './arcade/arcadeRunState';
import { createWaveAsteroids } from './arcade/waves';
import { ALL_WEAPONS, type SceneWeaponPolicy } from '../weapons/scenePolicy';
import { AsteroidBodies } from '../asteroids/bodies';
import { ProjectileBodies } from '../projectiles/bodies';
import { FuelBlobViews } from '../fuel/blobViews';
import { ParticleViews } from '../particles/views';
import { PlayerBody } from '../player/body';
import { BaseGameScene } from './BaseGameScene';
import { isTractorActive, updateWeapons } from '../weapons/use';

export class PhaserArcadeScene extends BaseGameScene {
  private actions!: ActionReader;
  private sceneRenderer!: ArcadeRenderer;
  private playerBody!: PlayerBody;
  private worldSize!: WorldSize;
  private session!: ArcadeRunState;
  private contacts!: MatterContacts;
  private asteroidBodies!: AsteroidBodies;
  private projectileBodies!: ProjectileBodies;
  private fuelBlobViews!: FuelBlobViews;
  private particleViews!: ParticleViews;
  private lastThrusterAt = 0;
  private readonly weaponPolicy: SceneWeaponPolicy = { allowedWeapons: ALL_WEAPONS };

  constructor() {
    super('arcade');
  }

  create(): void {
    this.session = new ArcadeRunState(getStartingWave());
    this.worldSize = { width: this.scale.width, height: this.scale.height };
    this.actions = new ActionReader(this);
    createArcadeTextures(this);
    this.playerBody = new PlayerBody(this, { x: this.worldSize.width / 2, y: this.worldSize.height / 2 }, this.session.player);
    this.playerBody.body.setMass(18);
    this.playerBody.body.setFrictionAir(0);
    this.playerBody.body.setBounce(0.8);
    this.contacts = new MatterContacts(this);
    this.asteroidBodies = new AsteroidBodies(this);
    this.projectileBodies = new ProjectileBodies(this);
    this.fuelBlobViews = new FuelBlobViews(this);
    this.particleViews = new ParticleViews(this);
    this.contacts.setPlayer(this.playerBody.body.body);
    this.contacts.setShield(this.playerBody.shieldSensor.body);
    this.sceneRenderer = new ArcadeRenderer(this, this.playerBody.body, this.worldSize, this.weaponPolicy);
    this.spawnWave();
    this.scale.on('resize', this.handleResize, this);
  }

  protected readFrameInput(): ReturnType<ActionReader['read']> {
    return this.actions.read(this.session.player.position);
  }

  protected updateState(action: ReturnType<ActionReader['read']>, time: number, delta: number): void {
    if (this.session.lives <= 0 && (action.firePrimary || action.fireSecondary)) {
      this.scene.restart();
      return;
    }
    const timeScale = getTimeScale(action.timeDilation);
    this.matter.world.engine.timing.timeScale = timeScale;
    const deltaSeconds = (delta / 1000) * timeScale;
    this.updatePlayerActions(action, deltaSeconds, time);
    this.updateWorldState(delta, deltaSeconds);
    this.resolveCombat(time, action.shield);
    this.updateLifecycle(time);
  }

  private updatePlayerActions(action: ReturnType<ActionReader['read']>, deltaSeconds: number, time: number): void {
    this.session.player.updateAim(normalize(action.aim));
    const move = normalize(action.move);
    this.session.player.updateThrust(move, false);
    if (this.playerIsAlive()) this.updatePlayer(move, deltaSeconds, time);
    const weaponResult = updateWeapons({
      action: {
        firePrimary: action.firePrimary,
        fireSecondary: action.fireSecondary,
        playerActive: this.playerIsAlive(),
        timeDilation: action.timeDilation,
      },
      deltaSeconds,
      nextProjectileId: this.session.nextProjectileId,
      now: time,
      origin: this.session.player.position,
      player: this.session.player,
      policy: this.weaponPolicy,
      selectedWeapon: this.sceneRenderer.getSelectedWeapon(this.session.player.lastAim),
      ship: this.session.ship,
      shooterVelocity: this.session.player.velocity,
    });
    this.session.nextProjectileId = weaponResult.nextProjectileId;
    this.session.ship.assignWeapon('primary', weaponResult.primaryWeapon);
    this.session.ship.assignWeapon('secondary', weaponResult.secondaryWeapon);
    this.session.ship.setFuel(weaponResult.fuel);
    if (weaponResult.recoil.x !== 0 || weaponResult.recoil.y !== 0) {
      const velocity = this.session.player.velocity;
      this.playerBody.setVelocity({ x: velocity.x + weaponResult.recoil.x, y: velocity.y + weaponResult.recoil.y });
    }
    for (const projectile of weaponResult.projectiles) this.addProjectile(projectile);
    const tractorActive = weaponResult.tractorActive;
    applyTractorBeam(this.session.player.position, this.session.player.lastAim, this.session.world.asteroids, this.asteroidBodies, tractorActive);
    this.playerBody.updateShieldSensor(action.shield && this.playerIsAlive() && this.session.ship.fuel > 0);
  }

  private getTractorActive(action: ReturnType<ActionReader['read']>): boolean {
    return isTractorActive(this.weaponPolicy, this.session.ship, {
      firePrimary: action.firePrimary,
      fireSecondary: action.fireSecondary,
      playerActive: this.playerIsAlive(),
      timeDilation: action.timeDilation,
    });
  }

  private updateWorldState(deltaMs: number, deltaSeconds: number): void {
    for (const asteroid of this.session.world.asteroids) wrapAsteroid(asteroid, this.asteroidBodies, this.worldSize);
    this.asteroidBodies.syncAll(this.session.world.asteroids);
    this.collectFuelBlobs(deltaSeconds);
    this.removeExpiredParticles(deltaMs);
    for (const projectile of updateProjectiles(this.session.world.projectiles, this.projectileBodies, deltaSeconds, this.worldSize)) {
      this.removeProjectile(projectile);
    }
  }

  private resolveCombat(time: number, shieldActive: boolean): void {
    this.applyProjectileCombat();
    updateBlackHoles(
      this.session.world.projectiles,
      this.projectileBodies,
      this.session.world.asteroids,
      this.asteroidBodies,
      [],
      (projectile) => this.removeProjectile(projectile),
      (asteroid) => this.removeAsteroid(asteroid),
      (asteroid) => {
        this.session.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
        this.applyEffect(createAsteroidExplosion(asteroid, 0.7));
      },
      (projectile) => {
        if (projectile.absorbedFuel > 0) {
          this.addFuelBlobs(spawnFuelBlobs(projectile.position, projectile.velocity, projectile.absorbedFuel));
        }
        this.applyEffect(createExplosionBurst(projectile.position, projectile.velocity, Math.max(0.6, projectile.absorbedFuel * 0.12)));
      },
    );
    this.applyPlayerCombat(time, shieldActive);
  }

  private updateLifecycle(time: number): void {
    this.updateRespawn(time);
    this.updateWave(time);
  }

  protected renderState(action: ReturnType<ActionReader['read']>, time: number): void {
    this.sceneRenderer.render(time, this.session, action, this.getTractorActive(action));
  }

  private updatePlayer(move: Vector, deltaSeconds: number, now: number): void {
    const motion = updatePlayerMotion({
      body: this.playerBody,
      deltaSeconds,
      move,
      player: this.session.player,
      ship: this.session.ship,
      world: this.worldSize,
    });
    const { thrusting, thrustScale } = motion;
    if (thrusting) this.spawnThrusterParticle(move, now, thrustScale);
  }

  private spawnWave(): void {
    this.addAsteroids(createWaveAsteroids(this.session.wave, this.worldSize));
  }

  private applyProjectileCombat(): void {
    for (const event of resolveProjectileContactCombat(this.contacts.consumeProjectileAsteroids(), this.asteroidBodies)) {
      if (event.type === 'projectileHitAsteroid') {
        this.removeProjectile(event.projectile);
      } else {
        const destruction = destroyAsteroidWithWeapon(event.asteroid);
        this.session.awardAsteroidScore(ASTEROIDS[event.asteroid.tier].points);
        this.addParticles(destruction.particles);
        this.addFuelBlobs(destruction.fuelBlobs);
        this.addAsteroids(destruction.children);
        this.removeAsteroid(event.asteroid);
      }
    }
  }

  private applyPlayerCombat(now: number, shieldActive: boolean): void {
    const result = resolvePlayerCombat({
      asteroids: shieldActive ? this.contacts.consumeShieldAsteroids() : this.contacts.consumePlayerAsteroids(),
      fuel: this.session.ship.fuel,
      invulnerable: now < this.session.player.invulnerableUntil,
      now,
      playerAlive: this.playerIsAlive(),
      playerPosition: this.session.player.position,
      playerVelocity: this.session.player.velocity,
      shieldActive,
      shieldHitUntil: this.session.player.shieldHitUntil,
    });
    this.session.ship.setFuel(result.fuel);
    this.session.player.shieldHitUntil = result.shieldHitUntil;
    this.playerBody.setVelocity(result.playerVelocity);
    for (const mutation of result.asteroidMutations) {
      if (mutation.velocity) {
        mutation.asteroid.velocity = mutation.velocity;
        this.asteroidBodies.get(mutation.asteroid).setVelocity(mutation.velocity.x, mutation.velocity.y);
      }
      if (mutation.position) this.asteroidBodies.get(mutation.asteroid).setPosition(mutation.position.x, mutation.position.y);
    }
    if (result.playerDestroyed) {
      this.session.destroyPlayer(now);
      for (const effect of createShipExplosion(this.session.player.position, this.session.player.velocity)) this.applyEffect(effect);
      this.playerBody.setVisible(false);
    }
  }

  private collectFuelBlobs(deltaSeconds: number): void {
    const result = updateFuelBlobs(this.session.world.fuelBlobs, this.session.player.position, this.playerIsAlive() && this.session.ship.fuel < MAX_FUEL, deltaSeconds, this.worldSize);
    for (const blob of this.session.world.fuelBlobs) this.fuelBlobViews.sync(blob);
    this.session.ship.collectFuel(result.fuelGain);
    for (const blob of result.collected) this.removeFuelBlob(blob);
  }

  private removeExpiredParticles(deltaMs: number): void {
    const expired = updateParticles(this.session.world.particles, deltaMs);
    for (const particle of expired) this.removeParticle(particle);
    for (const particle of this.session.world.particles) this.particleViews.sync(particle);
  }

  private updateRespawn(now: number): void {
    if (this.session.lives <= 0) {
      this.showGameOver();
      return;
    }
    if (!this.session.shouldRespawn(now)) return;
    const position = chooseSafePlayerPosition(this.session.world.asteroids, this.worldSize);
    this.playerBody.setPosition(position);
    this.playerBody.setVelocity({ x: 0, y: 0 });
    this.playerBody.setVisible(true);
    this.session.respawn(now);
  }

  private spawnThrusterParticle(move: Vector, now: number, thrustScale: number): void {
    const interval = thrustScale < 1 ? 30 : 10;
    if (now - this.lastThrusterAt < interval) return;
    this.lastThrusterAt = now;
    const exhaustDirection = { x: -move.x, y: -move.y };
    const emitter = {
      x: this.session.player.position.x + exhaustDirection.x * 30,
      y: this.session.player.position.y + exhaustDirection.y * 30,
    };
    this.addParticles(createThrusterParticles(emitter, exhaustDirection, thrustScale));
  }

  private applyEffect(effect: EffectResult): void {
    this.addParticles(effect.particles);
    if (effect.shakeDurationMs > 0) this.startShake(effect.shakeIntensity, effect.shakeDurationMs);
  }

  private startShake(intensity: number, durationMs: number): void {
    this.sceneRenderer.startShake(intensity, durationMs);
  }

  private showGameOver(): void {
    this.sceneRenderer.showGameOver(this.worldSize);
  }

  private updateWave(now: number): void {
    if (this.session.advanceWave(now)) this.spawnWave();
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    this.contacts.removeProjectile(projectile);
    this.projectileBodies.remove(projectile);
    this.session.world.removeProjectile(projectile);
  }

  private addProjectile(projectile: ProjectileEntity): void {
    this.session.world.projectiles.push(projectile);
    this.projectileBodies.add(projectile);
    this.contacts.addProjectile(projectile, this.projectileBodies);
  }

  private removeAsteroid(asteroid: AsteroidEntity): void {
    this.contacts.removeAsteroid(asteroid);
    this.asteroidBodies.remove(asteroid);
    this.session.world.removeAsteroid(asteroid);
  }

  private removeFuelBlob(blob: FuelBlobEntity): void {
    this.fuelBlobViews.remove(blob);
    this.session.world.removeFuelBlob(blob);
  }

  private removeParticle(particle: ParticleEntity): void {
    this.particleViews.remove(particle);
    this.session.world.removeParticle(particle);
  }

  private playerIsAlive(): boolean {
    return this.session.playerAlive;
  }

  private addAsteroids(asteroids: AsteroidEntity[]): void {
    this.session.world.addAsteroids(asteroids);
    for (const asteroid of asteroids) {
      this.asteroidBodies.add(asteroid);
      this.contacts.addAsteroid(asteroid, this.asteroidBodies);
    }
  }

  private addFuelBlobs(blobs: FuelBlobEntity[]): void {
    this.session.world.addFuelBlobs(blobs);
    for (const blob of blobs) this.fuelBlobViews.add(blob);
  }

  private addParticles(particles: ParticleEntity[]): void {
    this.session.world.addParticles(particles);
    for (const particle of particles) this.particleViews.add(particle);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
  }
}
