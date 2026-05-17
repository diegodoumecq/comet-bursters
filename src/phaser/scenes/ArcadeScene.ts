import Phaser from 'phaser';

import type { AsteroidEntity, FuelBlobEntity, MatterImage, ParticleEntity, ProjectileEntity, Vector, WorldSize } from '../model';
import { ActionReader } from '../services/actions';
import { ASTEROIDS, splitAsteroid, updateAsteroids } from '../services/asteroids';
import { updateBlackHoles } from '../services/blackHoles';
import { resolvePlayerCombat, resolveProjectileContactCombat } from './arcade/combat';
import { createAsteroidExplosion, createExplosionBurst, createShipExplosion, createThrusterParticles, type EffectResult } from './arcade/effects';
import { MAX_FUEL } from '../services/fuel';
import { spawnAsteroidFuelDrops, spawnFuelBlobs, updateFuelBlobs } from '../services/fuelBlobs';
import { chooseSafePlayerPosition } from '../services/gameSession';
import { MatterContacts } from './arcade/matterContacts';
import { updateParticles } from '../services/particles';
import { applyPlayerThrust } from './arcade/playerMotion';
import { updateProjectiles } from '../services/projectiles';
import { createShieldSensor, updateShieldSensor } from './arcade/shieldSensor';
import { getTimeScale } from '../services/time';
import { applyTractorBeam } from '../services/tractorBeam';
import { createProjectileShape } from '../services/weaponRender';
import { normalize, wrapPoint } from '../services/world';
import { getStartingWave } from '../runtime/startup';
import { ArcadePresentation } from './arcade/ArcadePresentation';
import { createArcadeTextures } from './arcade/arcadeVisuals';
import { ArcadeRunState } from './arcade/arcadeRunState';
import { createWaveAsteroids } from './arcade/waves';
import { ALL_WEAPONS, type SceneWeaponPolicy } from '../services/sceneWeaponPolicy';

export class PhaserArcadeScene extends Phaser.Scene {
  private actions!: ActionReader;
  private shieldSensor!: MatterImage;
  private presentation!: ArcadePresentation;
  private player!: MatterImage;
  private worldSize!: WorldSize;
  private session!: ArcadeRunState;
  private contacts!: MatterContacts;
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
    this.player = this.matter.add.image(this.worldSize.width / 2, this.worldSize.height / 2, 'phaser-ship') as MatterImage;
    this.player.setCircle(18);
    this.player.setMass(18);
    this.player.setFrictionAir(0);
    this.player.setBounce(0.8);
    this.contacts = new MatterContacts(this);
    this.contacts.setPlayer(this.player.body);
    this.shieldSensor = createShieldSensor(this, this.player);
    this.contacts.setShield(this.shieldSensor.body);
    this.presentation = new ArcadePresentation(this, this.player, this.worldSize, this.weaponPolicy);
    this.spawnWave();
    this.scale.on('resize', this.handleResize, this);
  }

  update(time: number, delta: number): void {
    const action = this.actions.read(this.player);
    if (this.session.lives <= 0 && (action.firePrimary || action.fireSecondary)) {
      this.scene.restart();
      return;
    }
    const deltaSeconds = (delta / 1000) * getTimeScale(action.timeDilation);
    this.updateInputPhase(action, deltaSeconds, time);
    this.updateWorldMotionPhase(time, delta, deltaSeconds);
    this.updateCombatPhase(time, action.shield);
    this.updateLifecyclePhase(time);
    this.updatePresentationPhase(time, action);
  }

  private updateInputPhase(action: ReturnType<ActionReader['read']>, deltaSeconds: number, time: number): void {
    this.session.player.updateAim(normalize(action.aim));
    const move = normalize(action.move);
    if (this.playerIsAlive()) this.updatePlayer(move, deltaSeconds, time);
    this.updateWeaponInput(action, time);
    const tractorActive = this.session.isTractorActive(this.weaponPolicy, {
      firePrimary: action.firePrimary,
      fireSecondary: action.fireSecondary,
      playerAlive: this.playerIsAlive(),
      timeDilation: action.timeDilation,
    });
    this.session.spendTractorFuel(deltaSeconds, tractorActive);
    applyTractorBeam(this.player, this.session.player.lastAim, this.session.world.asteroids, tractorActive);
    updateShieldSensor(this.shieldSensor, this.player, action.shield && this.playerIsAlive() && this.session.ship.fuel > 0);
  }

  private updateWorldMotionPhase(time: number, deltaMs: number, deltaSeconds: number): void {
    updateAsteroids(this.session.world.asteroids, deltaSeconds, this.worldSize);
    this.collectFuelBlobs(deltaSeconds);
    this.removeExpiredParticles(deltaMs);
    for (const projectile of updateProjectiles(this.session.world.projectiles, time, deltaSeconds, this.worldSize)) {
      this.removeProjectile(projectile);
    }
  }

  private updateCombatPhase(time: number, shieldActive: boolean): void {
    this.applyProjectileCombat();
    updateBlackHoles(
      this.session.world.projectiles,
      this.session.world.asteroids,
      [],
      time,
      (projectile) => this.removeProjectile(projectile),
      (asteroid) => this.removeAsteroid(asteroid),
      (asteroid) => {
        this.session.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
        this.applyEffect(createAsteroidExplosion(this, asteroid, 0.7));
      },
      (projectile) => {
        if (projectile.absorbedFuel > 0) {
          this.session.world.addFuelBlobs(spawnFuelBlobs(
            this,
            { x: projectile.shape.x, y: projectile.shape.y },
            projectile.velocity,
            projectile.absorbedFuel,
          ));
        }
        this.applyEffect(createExplosionBurst(this, projectile.shape, projectile.velocity, Math.max(0.6, projectile.absorbedFuel * 0.12)));
      },
    );
    this.applyPlayerCombat(time, shieldActive);
  }

  private updateLifecyclePhase(time: number): void {
    this.updateRespawn(time);
    this.updateWave(time);
  }

  private updatePresentationPhase(time: number, action: ReturnType<ActionReader['read']>): void {
    const playerAlive = this.playerIsAlive();
    this.presentation.update(time, this.session.player.lastAim, {
      asteroids: this.session.world.asteroids.length,
      fuel: this.session.ship.fuel,
      invulnerableUntil: this.session.player.invulnerableUntil,
      lives: this.session.lives,
      playerAlive,
      primary: this.session.ship.primaryWeapon,
      projectiles: this.session.world.projectiles.length,
      score: this.session.score,
      secondary: this.session.ship.secondaryWeapon,
      shieldActive: action.shield,
      timeDilation: action.timeDilation,
      tractorActive: this.session.isTractorActive(this.weaponPolicy, {
        firePrimary: action.firePrimary,
        fireSecondary: action.fireSecondary,
        playerAlive,
        timeDilation: action.timeDilation,
      }),
      wave: this.session.wave,
    });
  }

  private updateWeaponInput(action: ReturnType<ActionReader['read']>, time: number): void {
    if (action.timeDilation) {
      const selectedWeapon = this.presentation.getSelectedWeapon(this.session.player.lastAim);
      if (action.firePrimary) this.session.ship.assignWeapon('primary', selectedWeapon);
      if (action.fireSecondary) this.session.ship.assignWeapon('secondary', selectedWeapon);
    } else {
      if (this.playerIsAlive() && action.firePrimary) {
        const velocity = this.player.body.velocity;
        const fire = this.session.fireWeapon(this.weaponPolicy, this.session.ship.primaryWeapon, this.session.player.lastAim, time, velocity, (kind, angle) => createProjectileShape(this, this.player, kind, angle));
        this.player.setVelocity(velocity.x + fire.recoil.x, velocity.y + fire.recoil.y);
        for (const projectile of fire.projectiles) {
          this.session.world.projectiles.push(projectile);
          this.contacts.addProjectile(projectile);
        }
      }
      if (this.playerIsAlive() && action.fireSecondary) {
        const velocity = this.player.body.velocity;
        const fire = this.session.fireWeapon(this.weaponPolicy, this.session.ship.secondaryWeapon, this.session.player.lastAim, time, velocity, (kind, angle) => createProjectileShape(this, this.player, kind, angle));
        this.player.setVelocity(velocity.x + fire.recoil.x, velocity.y + fire.recoil.y);
        for (const projectile of fire.projectiles) {
          this.session.world.projectiles.push(projectile);
          this.contacts.addProjectile(projectile);
        }
      }
    }
  }

  private updatePlayer(move: Vector, deltaSeconds: number, now: number): void {
    if (Math.hypot(move.x, move.y) > 0) this.player.setRotation(Math.atan2(move.y, move.x) + Math.PI * 0.5);
    const motion = applyPlayerThrust(this.player, move, this.session.ship.fuel, deltaSeconds);
    this.session.ship.setFuel(motion.fuel);
    const { thrusting, thrustScale } = motion;
    if (thrusting) this.spawnThrusterParticle(move, now, thrustScale);
    wrapPoint(this.player, this.worldSize);
  }

  private spawnWave(): void {
    this.addAsteroids(createWaveAsteroids(this, this.session.wave, this.worldSize));
  }

  private applyProjectileCombat(): void {
    for (const event of resolveProjectileContactCombat(this.contacts.consumeProjectileAsteroids())) {
      if (event.type === 'projectileHitAsteroid') {
        this.removeProjectile(event.projectile);
      } else {
        this.session.awardAsteroidScore(ASTEROIDS[event.asteroid.tier].points);
        this.applyEffect(createAsteroidExplosion(this, event.asteroid, 1));
        this.session.world.addFuelBlobs(spawnAsteroidFuelDrops(this, event.asteroid));
        this.addAsteroids(splitAsteroid(this, event.asteroid));
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
      playerPosition: this.player,
      playerVelocity: this.player.body.velocity,
      shieldActive,
      shieldHitUntil: this.session.player.shieldHitUntil,
    });
    this.session.ship.setFuel(result.fuel);
    this.session.player.shieldHitUntil = result.shieldHitUntil;
    this.player.setVelocity(result.playerVelocity.x, result.playerVelocity.y);
    for (const mutation of result.asteroidMutations) {
      if (mutation.velocity) {
        mutation.asteroid.velocity = mutation.velocity;
        mutation.asteroid.body.setVelocity(mutation.velocity.x, mutation.velocity.y);
      }
      if (mutation.position) mutation.asteroid.body.setPosition(mutation.position.x, mutation.position.y);
    }
    if (result.playerDestroyed) {
      this.session.destroyPlayer(now);
      for (const effect of createShipExplosion(this, this.player, this.player.body.velocity)) this.applyEffect(effect);
      this.player.setVisible(false);
    }
  }

  private collectFuelBlobs(deltaSeconds: number): void {
    const result = updateFuelBlobs(this.session.world.fuelBlobs, this.player, this.playerIsAlive() && this.session.ship.fuel < MAX_FUEL, deltaSeconds, this.worldSize);
    this.session.ship.collectFuel(result.fuelGain);
    for (const blob of result.collected) this.removeFuelBlob(blob);
  }

  private removeExpiredParticles(deltaMs: number): void {
    for (const particle of updateParticles(this.session.world.particles, deltaMs)) this.removeParticle(particle);
  }

  private updateRespawn(now: number): void {
    if (this.session.lives <= 0) {
      this.showGameOver();
      return;
    }
    if (!this.session.shouldRespawn(now)) return;
    const position = chooseSafePlayerPosition(this.session.world.asteroids, this.worldSize);
    this.player.setPosition(position.x, position.y);
    this.player.setVelocity(0, 0);
    this.player.setVisible(true);
    this.session.respawn(now);
  }

  private spawnThrusterParticle(move: Vector, now: number, thrustScale: number): void {
    const interval = thrustScale < 1 ? 95 : 45;
    if (now - this.lastThrusterAt < interval) return;
    this.lastThrusterAt = now;
    this.session.world.addParticles(createThrusterParticles(this, this.player, this.player.body.velocity, move, thrustScale));
  }

  private applyEffect(effect: EffectResult): void {
    this.session.world.addParticles(effect.particles);
    if (effect.shakeDurationMs > 0) this.startShake(effect.shakeIntensity, effect.shakeDurationMs);
  }

  private startShake(intensity: number, durationMs: number): void {
    this.presentation.startShake(intensity, durationMs);
  }

  private showGameOver(): void {
    this.presentation.showGameOver(this.worldSize);
  }

  private updateWave(now: number): void {
    if (this.session.advanceWave(now)) this.spawnWave();
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    this.contacts.removeProjectile(projectile);
    projectile.shape.destroy();
    this.session.world.removeProjectile(projectile);
  }

  private removeAsteroid(asteroid: AsteroidEntity): void {
    this.contacts.removeAsteroid(asteroid);
    asteroid.body.destroy();
    this.session.world.removeAsteroid(asteroid);
  }

  private removeFuelBlob(blob: FuelBlobEntity): void {
    blob.shape.destroy();
    this.session.world.removeFuelBlob(blob);
  }

  private removeParticle(particle: ParticleEntity): void {
    particle.shape.destroy();
    this.session.world.removeParticle(particle);
  }

  private playerIsAlive(): boolean {
    return this.session.playerAlive;
  }

  private addAsteroids(asteroids: AsteroidEntity[]): void {
    this.session.world.addAsteroids(asteroids);
    for (const asteroid of asteroids) this.contacts.addAsteroid(asteroid);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
  }
}
