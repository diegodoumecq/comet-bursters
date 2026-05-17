import Phaser from 'phaser';

import type { AsteroidEntity, FuelBlobEntity, MatterImage, ParticleEntity, ProjectileEntity, Vector, WorldSize } from '../model';
import { ActionReader } from '../services/actions';
import { ASTEROIDS, createWaveAsteroids, splitAsteroid, updateAsteroids } from '../services/asteroids';
import { updateBlackHoles } from '../services/blackHoles';
import { resolvePlayerCombat, resolveProjectileContactCombat } from '../services/combat';
import { createAsteroidExplosion, createExplosionBurst, createShipExplosion, createThrusterParticles, type EffectResult } from '../services/effects';
import { MAX_FUEL } from '../services/fuel';
import { spawnAsteroidFuelDrops, spawnFuelBlobs, updateFuelBlobs } from '../services/fuelBlobs';
import { chooseSafePlayerPosition, isPlayerAlive } from '../services/gameSession';
import { GameWorld } from '../services/gameWorld';
import { MatterContacts } from '../services/matterContacts';
import { updateParticles } from '../services/particles';
import { applyPlayerThrust } from '../services/playerMotion';
import { updateProjectiles } from '../services/projectiles';
import { createShieldSensor, updateShieldSensor } from '../services/shieldSensor';
import { getTimeScale } from '../services/time';
import { applyTractorBeam, drawTractorBeam } from '../services/tractorBeam';
import { createProjectileShape } from '../services/weaponRender';
import { normalize, wrapPoint } from '../services/world';
import { getStartingWave } from '../runtime/startup';
import { Hud } from '../ui/Hud';
import { createGameBackground, createGameOverText, createGameTextures, drawShield, updateCameraShake, updatePlayerBlink } from '../ui/gameVisuals';
import { WeaponMenu } from '../ui/WeaponMenu';

export class PhaserGameScene extends Phaser.Scene {
  private actions!: ActionReader;
  private beam!: Phaser.GameObjects.Graphics;
  private shield!: Phaser.GameObjects.Graphics;
  private shieldSensor!: MatterImage;
  private hud!: Hud;
  private weaponMenu!: WeaponMenu;
  private player!: MatterImage;
  private turret!: Phaser.GameObjects.Line;
  private worldSize!: WorldSize;
  private world!: GameWorld;
  private contacts!: MatterContacts;
  private shakeUntil = 0;
  private shakeIntensity = 0;
  private gameOverText: Phaser.GameObjects.Text | null = null;
  private lastThrusterAt = 0;

  constructor() {
    super('game');
  }

  create(): void {
    this.world = new GameWorld(getStartingWave());
    this.worldSize = { width: this.scale.width, height: this.scale.height };
    this.actions = new ActionReader(this);
    createGameTextures(this);
    createGameBackground(this, this.worldSize);
    this.player = this.matter.add.image(this.worldSize.width / 2, this.worldSize.height / 2, 'phaser-ship') as MatterImage;
    this.player.setCircle(18);
    this.player.setMass(18);
    this.player.setFrictionAir(0);
    this.player.setBounce(0.8);
    this.contacts = new MatterContacts(this);
    this.contacts.setPlayer(this.player.body);
    this.shieldSensor = createShieldSensor(this, this.player);
    this.contacts.setShield(this.shieldSensor.body);
    this.turret = this.add.line(this.player.x, this.player.y, 0, 0, 0, -52, 0xffffff).setLineWidth(3, 3);
    this.beam = this.add.graphics();
    this.shield = this.add.graphics();
    this.hud = new Hud(this);
    this.weaponMenu = new WeaponMenu(this);
    this.spawnWave();
    this.scale.on('resize', this.handleResize, this);
  }

  update(time: number, delta: number): void {
    const action = this.actions.read(this.player);
    if (this.world.lives <= 0 && (action.firePrimary || action.fireSecondary)) {
      this.scene.restart();
      return;
    }
    const deltaSeconds = (delta / 1000) * getTimeScale(action.timeDilation);
    this.updateInputPhase(action, deltaSeconds, time);
    this.updateWorldMotionPhase(time, delta, deltaSeconds);
    this.updateCombatPhase(time, action.shield);
    this.updateLifecyclePhase(time);
    this.updatePresentationPhase(time, action.timeDilation);
  }

  private updateInputPhase(action: ReturnType<ActionReader['read']>, deltaSeconds: number, time: number): void {
    this.world.updateAim(normalize(action.aim));
    const move = normalize(action.move);
    if (this.playerIsAlive()) this.updatePlayer(move, deltaSeconds, time);
    this.updateTurret();
    this.updateWeaponInput(action, time);
    const tractorActive = this.world.isTractorActive({
      firePrimary: action.firePrimary,
      fireSecondary: action.fireSecondary,
      playerAlive: this.playerIsAlive(),
      timeDilation: action.timeDilation,
    });
    this.world.spendTractorFuel(deltaSeconds, tractorActive);
    applyTractorBeam(this.player, this.world.lastAim, this.world.asteroids, tractorActive);
    drawTractorBeam(this.beam, this.player, this.world.lastAim, tractorActive);
    drawShield(this.shield, this.player, action.shield, this.playerIsAlive() && this.world.fuel > 0);
    updateShieldSensor(this.shieldSensor, this.player, action.shield && this.playerIsAlive() && this.world.fuel > 0);
    this.weaponMenu.draw(this.player, this.world.lastAim, this.world.primaryWeapon, this.world.secondaryWeapon, action.timeDilation);
  }

  private updateWorldMotionPhase(time: number, deltaMs: number, deltaSeconds: number): void {
    updateAsteroids(this.world.asteroids, deltaSeconds, this.worldSize);
    this.collectFuelBlobs(deltaSeconds);
    this.removeExpiredParticles(deltaMs);
    for (const projectile of updateProjectiles(this.world.projectiles, time, deltaSeconds, this.worldSize)) {
      this.removeProjectile(projectile);
    }
  }

  private updateCombatPhase(time: number, shieldActive: boolean): void {
    this.applyProjectileCombat();
    updateBlackHoles(
      this.world.projectiles,
      this.world.asteroids,
      [],
      time,
      (projectile) => this.removeProjectile(projectile),
      (asteroid) => this.removeAsteroid(asteroid),
      (asteroid) => {
        this.world.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
        this.applyEffect(createAsteroidExplosion(this, asteroid, 0.7));
      },
      (projectile) => {
        if (projectile.absorbedFuel > 0) {
          this.world.addFuelBlobs(spawnFuelBlobs(
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

  private updatePresentationPhase(time: number, timeDilation: boolean): void {
    updatePlayerBlink(this.player, this.playerIsAlive(), this.world.invulnerableUntil, time);
    this.shakeIntensity = updateCameraShake(this.cameras.main, time, this.shakeUntil, this.shakeIntensity).shakeIntensity;
    this.hud.update({ asteroids: this.world.asteroids.length, fuel: this.world.fuel, lives: this.world.lives, primary: this.world.primaryWeapon, projectiles: this.world.projectiles.length, score: this.world.score, secondary: this.world.secondaryWeapon, timeDilation, wave: this.world.wave });
  }

  private updateTurret(): void {
    this.turret.setVisible(this.playerIsAlive());
    this.turret.setPosition(this.player.x, this.player.y);
    this.turret.setRotation(Math.atan2(this.world.lastAim.y, this.world.lastAim.x) + Math.PI * 0.5);
  }

  private updateWeaponInput(action: ReturnType<ActionReader['read']>, time: number): void {
    if (action.timeDilation) {
      const selectedWeapon = this.weaponMenu.getSelected(this.world.lastAim);
      if (action.firePrimary) this.world.assignWeapon('primary', selectedWeapon);
      if (action.fireSecondary) this.world.assignWeapon('secondary', selectedWeapon);
    } else {
      if (this.playerIsAlive() && action.firePrimary) {
        const velocity = this.player.body.velocity;
        const fire = this.world.fireWeapon(this.world.primaryWeapon, this.world.lastAim, time, velocity, (kind, angle) => createProjectileShape(this, this.player, kind, angle));
        this.player.setVelocity(velocity.x + fire.recoil.x, velocity.y + fire.recoil.y);
        for (const projectile of fire.projectiles) {
          this.contacts.addProjectile(projectile);
        }
      }
      if (this.playerIsAlive() && action.fireSecondary) {
        const velocity = this.player.body.velocity;
        const fire = this.world.fireWeapon(this.world.secondaryWeapon, this.world.lastAim, time, velocity, (kind, angle) => createProjectileShape(this, this.player, kind, angle));
        this.player.setVelocity(velocity.x + fire.recoil.x, velocity.y + fire.recoil.y);
        for (const projectile of fire.projectiles) {
          this.contacts.addProjectile(projectile);
        }
      }
    }
  }

  private updatePlayer(move: Vector, deltaSeconds: number, now: number): void {
    if (Math.hypot(move.x, move.y) > 0) this.player.setRotation(Math.atan2(move.y, move.x) + Math.PI * 0.5);
    const motion = applyPlayerThrust(this.player, move, this.world.fuel, deltaSeconds);
    this.world.applyThrustFuel(motion.fuel);
    const { thrusting, thrustScale } = motion;
    if (thrusting) this.spawnThrusterParticle(move, now, thrustScale);
    wrapPoint(this.player, this.worldSize);
  }

  private spawnWave(): void {
    this.addAsteroids(createWaveAsteroids(this, this.world.wave, this.worldSize));
  }

  private applyProjectileCombat(): void {
    for (const event of resolveProjectileContactCombat(this.contacts.consumeProjectileAsteroids())) {
      if (event.type === 'projectileHitAsteroid') {
        this.removeProjectile(event.projectile);
      } else {
        this.world.awardAsteroidScore(ASTEROIDS[event.asteroid.tier].points);
        this.applyEffect(createAsteroidExplosion(this, event.asteroid, 1));
        this.world.addFuelBlobs(spawnAsteroidFuelDrops(this, event.asteroid));
        this.addAsteroids(splitAsteroid(this, event.asteroid));
        this.removeAsteroid(event.asteroid);
      }
    }
  }

  private applyPlayerCombat(now: number, shieldActive: boolean): void {
    const result = resolvePlayerCombat({
      asteroids: shieldActive ? this.contacts.consumeShieldAsteroids() : this.contacts.consumePlayerAsteroids(),
      fuel: this.world.fuel,
      invulnerable: now < this.world.invulnerableUntil,
      now,
      playerAlive: this.playerIsAlive(),
      playerPosition: this.player,
      playerVelocity: this.player.body.velocity,
      shieldActive,
      shieldHitUntil: this.world.shieldHitUntil,
    });
    this.world.applyPlayerCombatState(result);
    this.player.setVelocity(result.playerVelocity.x, result.playerVelocity.y);
    for (const mutation of result.asteroidMutations) {
      if (mutation.velocity) {
        mutation.asteroid.velocity = mutation.velocity;
        mutation.asteroid.body.setVelocity(mutation.velocity.x, mutation.velocity.y);
      }
      if (mutation.position) mutation.asteroid.body.setPosition(mutation.position.x, mutation.position.y);
    }
    if (result.playerDestroyed) {
      this.world.destroyPlayer(now);
      for (const effect of createShipExplosion(this, this.player, this.player.body.velocity)) this.applyEffect(effect);
      this.player.setVisible(false);
      this.turret.setVisible(false);
    }
  }

  private collectFuelBlobs(deltaSeconds: number): void {
    const result = updateFuelBlobs(this.world.fuelBlobs, this.player, this.playerIsAlive() && this.world.fuel < MAX_FUEL, deltaSeconds, this.worldSize);
    this.world.collectFuel(result.fuelGain);
    for (const blob of result.collected) this.removeFuelBlob(blob);
  }

  private removeExpiredParticles(deltaMs: number): void {
    for (const particle of updateParticles(this.world.particles, deltaMs)) this.removeParticle(particle);
  }

  private updateRespawn(now: number): void {
    if (this.world.lives <= 0) {
      this.showGameOver();
      return;
    }
    if (!this.world.shouldRespawn(now)) return;
    const position = chooseSafePlayerPosition(this.world.asteroids, this.worldSize);
    this.player.setPosition(position.x, position.y);
    this.player.setVelocity(0, 0);
    this.player.setVisible(true);
    this.world.respawn(now);
  }

  private spawnThrusterParticle(move: Vector, now: number, thrustScale: number): void {
    const interval = thrustScale < 1 ? 95 : 45;
    if (now - this.lastThrusterAt < interval) return;
    this.lastThrusterAt = now;
    this.world.addParticles(createThrusterParticles(this, this.player, this.player.body.velocity, move, thrustScale));
  }

  private applyEffect(effect: EffectResult): void {
    this.world.addParticles(effect.particles);
    if (effect.shakeDurationMs > 0) this.startShake(effect.shakeIntensity, effect.shakeDurationMs);
  }

  private startShake(intensity: number, durationMs: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeUntil = Math.max(this.shakeUntil, this.time.now + durationMs);
  }

  private showGameOver(): void {
    if (this.gameOverText) return;
    this.gameOverText = createGameOverText(this, this.worldSize);
  }

  private updateWave(now: number): void {
    if (this.world.advanceWave(now)) this.spawnWave();
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    this.contacts.removeProjectile(projectile);
    projectile.shape.destroy();
    this.world.removeProjectile(projectile);
  }

  private removeAsteroid(asteroid: AsteroidEntity): void {
    this.contacts.removeAsteroid(asteroid);
    asteroid.body.destroy();
    this.world.removeAsteroid(asteroid);
  }

  private removeFuelBlob(blob: FuelBlobEntity): void {
    blob.shape.destroy();
    this.world.removeFuelBlob(blob);
  }

  private removeParticle(particle: ParticleEntity): void {
    particle.shape.destroy();
    this.world.removeParticle(particle);
  }

  private playerIsAlive(): boolean {
    return isPlayerAlive(this.world.respawnAt, this.world.lives);
  }

  private addAsteroids(asteroids: AsteroidEntity[]): void {
    this.world.addAsteroids(asteroids);
    for (const asteroid of asteroids) this.contacts.addAsteroid(asteroid);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
  }
}
