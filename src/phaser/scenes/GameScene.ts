import Phaser from 'phaser';

import type { AsteroidEntity, FuelBlobEntity, ParticleEntity, ProjectileEntity, Vector, WorldSize } from '../model';
import { ActionReader } from '../services/actions';
import { ASTEROIDS, createWaveAsteroids, resolveAsteroidCollisions, splitAsteroid, updateAsteroids } from '../services/asteroids';
import { updateBlackHoles } from '../services/blackHoles';
import { resolvePlayerCombat, resolveProjectileCombat } from '../services/combat';
import { createAsteroidExplosion, createExplosionBurst, createShipExplosion, createThrusterParticles, type EffectResult } from '../services/effects';
import { MAX_FUEL } from '../services/fuel';
import { spawnAsteroidFuelDrops, spawnFuelBlobs, updateFuelBlobs } from '../services/fuelBlobs';
import { chooseSafePlayerPosition, isPlayerAlive } from '../services/gameSession';
import { GameWorld } from '../services/gameWorld';
import { updateParticles } from '../services/particles';
import { updateProjectiles } from '../services/projectiles';
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
  private hud!: Hud;
  private weaponMenu!: WeaponMenu;
  private player!: Phaser.Physics.Matter.Image;
  private turret!: Phaser.GameObjects.Line;
  private worldSize!: WorldSize;
  private world!: GameWorld;
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
    this.player = this.matter.add.image(this.worldSize.width / 2, this.worldSize.height / 2, 'phaser-ship');
    this.player.setStatic(true);
    this.player.setCircle(18);
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
    this.weaponMenu.draw(this.player, this.world.lastAim, this.world.primaryWeapon, this.world.secondaryWeapon, action.timeDilation);
  }

  private updateWorldMotionPhase(time: number, deltaMs: number, deltaSeconds: number): void {
    updateAsteroids(this.world.asteroids, deltaSeconds, this.worldSize);
    this.collectFuelBlobs(deltaSeconds);
    this.removeExpiredParticles(deltaMs);
    resolveAsteroidCollisions(this.world.asteroids, this.worldSize);
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
      if (this.playerIsAlive() && action.firePrimary) this.world.fireWeapon(this.world.primaryWeapon, this.world.lastAim, time, (kind, angle) => createProjectileShape(this, this.player, kind, angle));
      if (this.playerIsAlive() && action.fireSecondary) this.world.fireWeapon(this.world.secondaryWeapon, this.world.lastAim, time, (kind, angle) => createProjectileShape(this, this.player, kind, angle));
    }
  }

  private updatePlayer(move: Vector, deltaSeconds: number, now: number): void {
    if (Math.hypot(move.x, move.y) > 0) this.player.setRotation(Math.atan2(move.y, move.x) + Math.PI * 0.5);
    const motion = this.world.applyPlayerMotion(move, deltaSeconds);
    const { thrusting, thrustScale } = motion;
    if (thrusting) this.spawnThrusterParticle(move, now, thrustScale);
    this.player.setPosition(this.player.x + this.world.playerVelocity.x * deltaSeconds, this.player.y + this.world.playerVelocity.y * deltaSeconds);
    wrapPoint(this.player, this.worldSize);
  }

  private spawnWave(): void {
    this.world.addAsteroids(createWaveAsteroids(this, this.world.wave, this.worldSize));
  }

  private applyProjectileCombat(): void {
    for (const event of resolveProjectileCombat([...this.world.projectiles], [...this.world.asteroids])) {
      if (event.type === 'projectileHitAsteroid') {
        this.removeProjectile(event.projectile);
      } else {
        this.world.awardAsteroidScore(ASTEROIDS[event.asteroid.tier].points);
        this.applyEffect(createAsteroidExplosion(this, event.asteroid, 1));
        this.world.addFuelBlobs(spawnAsteroidFuelDrops(this, event.asteroid));
        this.world.addAsteroids(splitAsteroid(this, event.asteroid));
        this.removeAsteroid(event.asteroid);
      }
    }
  }

  private applyPlayerCombat(now: number, shieldActive: boolean): void {
    const result = resolvePlayerCombat({
      asteroids: this.world.asteroids,
      fuel: this.world.fuel,
      invulnerable: now < this.world.invulnerableUntil,
      now,
      playerAlive: this.playerIsAlive(),
      playerPosition: this.player,
      playerVelocity: this.world.playerVelocity,
      shieldActive,
      shieldHitUntil: this.world.shieldHitUntil,
    });
    this.world.applyPlayerCombatState(result);
    for (const mutation of result.asteroidMutations) {
      if (mutation.velocity) mutation.asteroid.velocity = mutation.velocity;
      if (mutation.position) mutation.asteroid.body.setPosition(mutation.position.x, mutation.position.y);
    }
    if (result.playerDestroyed) {
      this.world.destroyPlayer(now);
      for (const effect of createShipExplosion(this, this.player, this.world.playerVelocity)) this.applyEffect(effect);
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
    this.player.setVisible(true);
    this.world.respawn(now);
  }

  private spawnThrusterParticle(move: Vector, now: number, thrustScale: number): void {
    const interval = thrustScale < 1 ? 95 : 45;
    if (now - this.lastThrusterAt < interval) return;
    this.lastThrusterAt = now;
    this.world.addParticles(createThrusterParticles(this, this.player, this.world.playerVelocity, move, thrustScale));
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
    projectile.shape.destroy();
    this.world.removeProjectile(projectile);
  }

  private removeAsteroid(asteroid: AsteroidEntity): void {
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

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
  }
}
