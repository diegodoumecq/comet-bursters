import Phaser from 'phaser';

import { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS } from '../asteroids/logic';
import { updateAsteroidSplitCollisions } from '../asteroids/splitCollisions';
import { destroyAsteroidWithWeapon } from '../combat/asteroidDestruction';
import { resolvePlayerCombat, resolveProjectileContactCombat } from '../combat/asteroids';
import {
  createAsteroidExplosion,
  createExplosionBurst,
  createShipExplosion,
  createThrusterParticles,
  type EffectResult,
} from '../combat/effects';
import { MatterContacts } from '../combat/matterContacts';
import { resolvePortalBridgeAsteroidCollisions } from '../combat/portalBridge';
import { getTimeScale } from '../core/time';
import type { Vector, WorldSize } from '../core/types';
import type { DimensionCoordinator } from '../dimensions/DimensionCoordinator';
import { createPortalAsteroidSpawn } from '../dimensions/PortalAsteroidSpawner';
import { PortalDirector } from '../dimensions/PortalDirector';
import { resetDimensionCoordinator } from '../dimensions/runtime';
import { spawnFuelBlobs, updateFuelBlobs } from '../fuel/blobLogic';
import { FuelBlobViews } from '../fuel/blobViews';
import { MAX_FUEL, SHIELD_RADIUS } from '../fuel/rules';
import type { FuelBlobEntity } from '../fuel/types';
import { ActionReader } from '../input/actions';
import { updateParticles } from '../particles/logic';
import type { ParticleEntity } from '../particles/types';
import { ParticleViews } from '../particles/views';
import { PlayerBody } from '../player/body';
import { PLAYER_COLLISION_RADIUS, PLAYER_MASS } from '../player/config';
import { updatePlayerMotion, updatePlayerStateMotion } from '../player/motion';
import { updateBlackHoles } from '../projectiles/blackHoles';
import { ProjectileBodies } from '../projectiles/bodies';
import { updateProjectiles } from '../projectiles/logic';
import type { ProjectileEntity } from '../projectiles/types';
import { getArcadeRiftDebugEnabled, getStartingWave } from '../runtime/startup';
import { ALL_WEAPONS, type SceneWeaponPolicy } from '../weapons/scenePolicy';
import { applyTractorBeam } from '../weapons/tractorBeam';
import { isTractorActive, updateWeapons } from '../weapons/use';
import { normalize, wrappedDelta } from '../world/geometry';
import { SpaceWorldRuntime } from '../world/SpaceWorldRuntime';
import { ArcadeRenderEffects } from './arcade/ArcadeRenderEffects';
import { ArcadeRenderer } from './arcade/ArcadeRenderer';
import { ArcadeRunState } from './arcade/arcadeRunState';
import {
  chooseSafePlayerPositionWithExclusions,
  getBlackHoleSpawnExclusions,
} from './arcade/arcadeSpawns';
import { createArcadeTextures } from './arcade/arcadeVisuals';
import { BaseGameScene } from './BaseGameScene';
import type { PhaserRiftSpaceScene } from './RiftSpaceScene';

const GAME_OVER_RESTART_DELAY_MS = 3000;

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
  private runtime!: SpaceWorldRuntime;
  private renderEffects!: ArcadeRenderEffects;
  private dimensionCoordinator!: DimensionCoordinator;
  private riftDirector!: PortalDirector;
  private gameOverAt = 0;
  private lastThrusterAt = 0;
  private nextPortalId = 1;
  private riftSpaceScene: PhaserRiftSpaceScene | null = null;
  private readonly riftDebug = getArcadeRiftDebugEnabled();
  private testRiftKey: Phaser.Input.Keyboard.Key | null = null;
  private readonly weaponPolicy: SceneWeaponPolicy = { allowedWeapons: ALL_WEAPONS };

  constructor() {
    super('arcade');
  }

  create(): void {
    const startingIntensity = getStartingWave();
    this.session = new ArcadeRunState(startingIntensity);
    this.riftDirector = new PortalDirector(startingIntensity);
    this.worldSize = { width: this.scale.width, height: this.scale.height };
    this.actions = new ActionReader(this);
    createArcadeTextures(this);
    this.playerBody = new PlayerBody(
      this,
      { x: this.worldSize.width / 2, y: this.worldSize.height / 2 },
      this.session.player,
    );
    this.playerBody.body.setMass(PLAYER_MASS);
    this.playerBody.body.setFrictionAir(0);
    this.playerBody.body.setBounce(0.8);
    this.contacts = new MatterContacts(this);
    this.asteroidBodies = new AsteroidBodies(this);
    this.projectileBodies = new ProjectileBodies(this);
    this.fuelBlobViews = new FuelBlobViews();
    this.particleViews = new ParticleViews(this);
    this.dimensionCoordinator = resetDimensionCoordinator();
    this.runtime = new SpaceWorldRuntime(
      'arcade',
      {
        asteroidBodies: this.asteroidBodies,
        contacts: this.contacts,
        fuelBlobViews: this.fuelBlobViews,
        particleViews: this.particleViews,
        persistentPlayerBody: true,
        projectileBodies: this.projectileBodies,
      },
      this.session.world,
    );
    this.runtime.attachPlayer(this.session.player, this.playerBody);
    this.dimensionCoordinator.registerWorld(this.runtime);
    this.contacts.setPlayer(this.playerBody.body.body);
    this.contacts.setShield(this.playerBody.shieldSensor.body);
    this.playerBody.setAsteroidCollisionEnabled(true);
    this.sceneRenderer = new ArcadeRenderer(
      this,
      this.playerBody.body,
      this.worldSize,
      this.weaponPolicy,
    );
    this.startRiftSpaceScene();
    this.renderEffects = new ArcadeRenderEffects(
      this.game.canvas,
      this.game.canvas.parentElement,
      () => {
        const canvas = this.sceneRenderer.getBackgroundCanvas();
        return canvas ? [canvas] : [];
      },
    );
    this.events.once('shutdown', this.disposeRenderEffects, this);
    if (this.riftDebug) {
      this.testRiftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.T) ?? null;
    }
    this.openRiftBurst(this.time.now);
    this.scale.on('resize', this.handleResize, this);
  }

  protected readFrameInput(): ReturnType<ActionReader['read']> {
    return this.actions.read(this.getPlayerActionOrigin());
  }

  protected updateState(
    action: ReturnType<ActionReader['read']>,
    time: number,
    delta: number,
  ): void {
    if (
      this.session.lives <= 0 &&
      this.gameOverAt > 0 &&
      time - this.gameOverAt >= GAME_OVER_RESTART_DELAY_MS &&
      (action.firePrimary || action.fireSecondary)
    ) {
      this.scene.restart();
      return;
    }
    const timeScale = getTimeScale(action.timeDilation);
    this.matter.world.engine.timing.timeScale = timeScale;
    const deltaSeconds = (delta / 1000) * timeScale;
    this.updateDebugRiftInput();
    this.updatePlayerActions(action, deltaSeconds, time);
    this.updateWorldState(delta, deltaSeconds);
    this.updateDimensionPortals(time);
    this.resolveCombat(time, action.shield, deltaSeconds);
    this.collectFuelBlobs(deltaSeconds);
    this.updateLifecycle(time);
  }

  private updatePlayerActions(
    action: ReturnType<ActionReader['read']>,
    deltaSeconds: number,
    time: number,
  ): void {
    const playerInRift = this.session.player.membership.space === 'rift';
    const aim = action.aim;
    this.session.player.updateAim(normalize(aim));
    const move = action.timeDilation ? { x: 0, y: 0 } : normalize(action.move);
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
      const nextVelocity = {
        x: velocity.x + weaponResult.recoil.x,
        y: velocity.y + weaponResult.recoil.y,
      };
      if (playerInRift) {
        this.session.player.velocity = nextVelocity;
        this.dimensionCoordinator.getWorld('rift')?.syncAttachedPlayerFromState();
      } else {
        this.playerBody.setVelocity(nextVelocity);
      }
    }
    for (const projectile of weaponResult.projectiles) {
      if (playerInRift) {
        this.dimensionCoordinator.getWorld('rift')?.addProjectile(projectile);
      } else {
        this.addProjectile(projectile);
      }
    }
    const tractorActive = weaponResult.tractorActive;
    if (!playerInRift) {
      applyTractorBeam(
        this.session.player.position,
        this.session.player.lastAim,
        this.session.world.asteroids,
        this.asteroidBodies,
        tractorActive,
      );
      const asteroidCollisionEnabled = this.playerCanCollideWithAsteroids();
      this.playerBody.setAsteroidCollisionEnabled(asteroidCollisionEnabled);
      this.playerBody.updateShieldSensor(
        action.shield && this.playerIsAlive() && this.session.ship.fuel > 0,
        asteroidCollisionEnabled,
      );
    } else {
      const riftRuntime = this.dimensionCoordinator.getWorld('rift');
      const riftPlayerBody = riftRuntime?.getPlayerBody();
      if (riftRuntime && riftPlayerBody) {
        applyTractorBeam(
          this.session.player.position,
          this.session.player.lastAim,
          riftRuntime.world.asteroids,
          riftRuntime.getAsteroidBodies(),
          tractorActive,
        );
        const asteroidCollisionEnabled = this.playerCanCollideWithAsteroids();
        riftPlayerBody.setAsteroidCollisionEnabled(asteroidCollisionEnabled);
        riftPlayerBody.updateShieldSensor(
          action.shield && this.playerIsAlive() && this.session.ship.fuel > 0,
          asteroidCollisionEnabled,
        );
      }
      this.playerBody.setCollisionEnabled(false);
      this.playerBody.updateShieldSensor(false);
    }
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
    this.asteroidBodies.syncToroidalAll(this.session.world.asteroids, this.worldSize);
    this.contacts.syncAsteroids(this.session.world.asteroids, this.asteroidBodies);
    updateAsteroidSplitCollisions(this.session.world.asteroids, this.asteroidBodies);
    this.removeExpiredParticles(deltaMs);
    for (const projectile of updateProjectiles(
      this.session.world.projectiles,
      this.projectileBodies,
      deltaSeconds,
      this.worldSize,
    )) {
      this.removeProjectile(projectile);
    }
  }

  private resolveCombat(time: number, shieldActive: boolean, deltaSeconds: number): void {
    this.applyRuntimeProjectileCombat(this.runtime);
    this.updateRuntimeBlackHoles(this.runtime, time, deltaSeconds);
    const riftRuntime = this.dimensionCoordinator.getWorld('rift');
    if (riftRuntime) {
      this.applyRuntimeProjectileCombat(riftRuntime);
      this.updateRuntimeBlackHoles(riftRuntime, time, deltaSeconds);
    }
    this.resolvePortalBridgeCollisions();
    this.applyPlayerCombat(this.getPlayerRuntime(), time, shieldActive);
  }

  private updateLifecycle(time: number): void {
    this.updateRespawn(time);
    this.updateRiftDirector(time);
  }

  protected renderState(action: ReturnType<ActionReader['read']>, time: number): void {
    const activePortal = this.dimensionCoordinator.getActivePortal();
    const renderablePortals = activePortal ? [activePortal] : [];
    this.riftSpaceScene?.setPortals(renderablePortals);
    this.sceneRenderer.setRiftPortals(renderablePortals);
    this.sceneRenderer.setPlayerInRift(this.session.player.membership.space === 'rift');
    this.sceneRenderer.render(time, this.session, action, this.getTractorActive(action));
    this.renderEffects.render(this.session, time, this.worldSize);
  }

  private updatePlayer(move: Vector, deltaSeconds: number, now: number): void {
    if (this.session.player.membership.space === 'rift') {
      const motion = updatePlayerStateMotion({
        deltaSeconds,
        move,
        player: this.session.player,
        ship: this.session.ship,
        world: this.worldSize,
        wrap: true,
      });
      const { thrusting, thrustScale } = motion;
      if (thrusting) this.spawnThrusterParticle(move, now, thrustScale);
      this.dimensionCoordinator.getWorld('rift')?.syncAttachedPlayerFromState();
      return;
    }
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

  private getPlayerActionOrigin(): Vector {
    return this.session.player.position;
  }

  private openRiftBurst(now: number): void {
    const plan = this.riftDirector.createPortalPlan({
      now,
      playerPosition: this.session.player.position,
      portalId: this.nextPortalId,
      world: this.worldSize,
    });
    this.nextPortalId += 1;
    this.session.burstCount = this.riftDirector.burstCount;
    this.dimensionCoordinator.openPortal(plan);
  }

  private updateDebugRiftInput(): void {
    if (this.testRiftKey && Phaser.Input.Keyboard.JustDown(this.testRiftKey)) {
      this.openRiftBurst(this.time.now);
    }
  }

  private startRiftSpaceScene(): void {
    if (!this.scene.isActive('rift-space')) {
      this.scene.launch('rift-space');
    }
    this.riftSpaceScene = this.scene.get('rift-space') as PhaserRiftSpaceScene;
    this.sceneRenderer.setPortalDestinationCanvasProvider(() => {
      if (this.riftSpaceScene) return this.riftSpaceScene.getRenderCanvas();
      throw new Error('Rift space scene is not available');
    });
  }

  private updateDimensionPortals(now: number): void {
    const commands = this.dimensionCoordinator.update(now);
    for (const command of commands) {
      if (command.type === 'spawnPortal') {
        const riftRuntime =
          this.riftSpaceScene?.getRuntime() ?? this.dimensionCoordinator.getWorld('rift');
        if (riftRuntime) {
          riftRuntime.addAsteroids(
            createPortalAsteroidSpawn({
              burstIndex: this.riftDirector.burstCount,
              plan: command.plan,
            }),
          );
        }
      }
    }
  }

  private applyRuntimeProjectileCombat(runtime: SpaceWorldRuntime): void {
    const activeProjectiles = new Set(runtime.world.projectiles);
    for (const event of resolveProjectileContactCombat(
      runtime
        .getContacts()
        .consumeProjectileAsteroids()
        .filter((contact) => activeProjectiles.has(contact.projectile)),
      runtime.getAsteroidBodies(),
    )) {
      if (event.type === 'projectileHitAsteroid') {
        runtime.removeProjectile(event.projectile);
      } else {
        const destruction = destroyAsteroidWithWeapon(event.asteroid);
        this.session.awardAsteroidScore(ASTEROIDS[event.asteroid.tier].points);
        runtime.addParticles(destruction.particles);
        runtime.addFuelBlobs(destruction.fuelBlobs);
        runtime.addAsteroids(destruction.children);
        runtime.removeAsteroid(event.asteroid);
      }
    }
  }

  private updateRuntimeBlackHoles(
    runtime: SpaceWorldRuntime,
    time: number,
    deltaSeconds: number,
  ): void {
    const playerBody = runtime.getPlayerBody();
    updateBlackHoles({
      asteroids: runtime.world.asteroids,
      asteroidBodies: runtime.getAsteroidBodies(),
      distance: (fromX, fromY, toX, toY) => {
        const delta = wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, this.worldSize);
        return Math.hypot(delta.x, delta.y);
      },
      fuelBlobs: runtime.world.fuelBlobs,
      getDelta: (fromX, fromY, toX, toY) =>
        wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, this.worldSize),
      now: time,
      onAsteroidAbsorbed: (asteroid) => {
        this.session.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
        runtime.addParticles(createAsteroidExplosion(asteroid, 0.7).particles);
      },
      onAsteroidRemoved: (asteroid) => runtime.removeAsteroid(asteroid),
      onBlackHoleRemoved: (projectile) => runtime.removeProjectile(projectile),
      onFuelBurst: (projectile) => {
        if (projectile.absorbedFuel > 0) {
          runtime.addFuelBlobs(
            spawnFuelBlobs(projectile.position, projectile.velocity, projectile.absorbedFuel),
          );
        }
        const effect = createExplosionBurst(
          projectile.position,
          projectile.velocity,
          Math.max(0.6, projectile.absorbedFuel * 0.12),
        );
        runtime.addParticles(effect.particles);
        if (effect.shakeDurationMs > 0)
          this.startShake(effect.shakeIntensity, effect.shakeDurationMs);
      },
      onFuelBlobAbsorbed: (blob) => runtime.removeFuelBlob(blob),
      onPlayerAbsorbed: () => this.killPlayer(time),
      player: {
        active:
          this.playerIsAlive() &&
          this.session.player.membership.space === runtime.space &&
          playerBody !== null,
        body: (playerBody ?? this.playerBody).body,
        position: this.session.player.position,
        velocity: this.session.player.velocity,
      },
      projectileBodies: runtime.getProjectileBodies(),
      projectiles: runtime.world.projectiles,
      timeScale: deltaSeconds * 60,
    });
  }

  private resolvePortalBridgeCollisions(): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    const riftRuntime = this.dimensionCoordinator.getWorld('rift');
    if (!riftRuntime) return;

    for (const mutation of resolvePortalBridgeAsteroidCollisions({
      arcadeAsteroids: this.runtime.world.asteroids,
      getDelta: (from, to) => wrappedDelta(from, to, this.worldSize),
      portal,
      riftAsteroids: riftRuntime.world.asteroids,
    })) {
      const runtime = mutation.asteroid.membership?.space === 'rift' ? riftRuntime : this.runtime;
      mutation.asteroid.position = mutation.position;
      mutation.asteroid.velocity = mutation.velocity;
      runtime
        .getAsteroidBodies()
        .get(mutation.asteroid)
        .setPosition(mutation.position.x, mutation.position.y);
      runtime
        .getAsteroidBodies()
        .get(mutation.asteroid)
        .setVelocity(mutation.velocity.x, mutation.velocity.y);
    }
  }

  private applyPlayerCombat(runtime: SpaceWorldRuntime, now: number, shieldActive: boolean): void {
    if (this.session.player.membership.space !== runtime.space) return;
    const playerBody = runtime.getPlayerBody();
    if (!playerBody) return;
    const result = resolvePlayerCombat({
      asteroids: shieldActive
        ? runtime.getContacts().consumeShieldAsteroids()
        : runtime.getContacts().consumePlayerAsteroids(),
      fuel: this.session.ship.fuel,
      getDelta: (from, to) => wrappedDelta(from, to, this.worldSize),
      invulnerable: now < this.session.player.invulnerableUntil,
      now,
      playerAlive: this.playerIsAlive(),
      playerPosition: this.session.player.position,
      playerRadius: PLAYER_COLLISION_RADIUS,
      playerVelocity: this.session.player.velocity,
      shieldActive,
      shieldRadius: SHIELD_RADIUS,
      shieldHitUntil: this.session.player.shieldHitUntil,
    });
    this.session.ship.setFuel(result.fuel);
    this.session.player.shieldHitUntil = result.shieldHitUntil;
    playerBody.setVelocity(result.playerVelocity);
    for (const mutation of result.asteroidMutations) {
      if (mutation.velocity) {
        mutation.asteroid.velocity = mutation.velocity;
        runtime
          .getAsteroidBodies()
          .get(mutation.asteroid)
          .setVelocity(mutation.velocity.x, mutation.velocity.y);
      }
      if (mutation.position)
        runtime
          .getAsteroidBodies()
          .get(mutation.asteroid)
          .setPosition(mutation.position.x, mutation.position.y);
    }
    if (result.playerDestroyed) this.killPlayer(now);
  }

  private killPlayer(now: number): void {
    if (!this.playerIsAlive()) return;
    this.session.destroyPlayer(now);
    const effects = createShipExplosion(this.session.player.position, this.session.player.velocity);
    if (this.session.player.membership.space === 'rift') {
      const riftRuntime = this.dimensionCoordinator.getWorld('rift');
      if (riftRuntime) {
        for (const effect of effects) riftRuntime.addParticles(effect.particles);
      }
    } else {
      for (const effect of effects) this.applyEffect(effect);
    }
    this.playerBody.setVisible(false);
  }

  private playerCanCollideWithAsteroids(): boolean {
    return this.playerIsAlive() && this.time.now >= this.session.player.invulnerableUntil;
  }

  private getPlayerRuntime(): SpaceWorldRuntime {
    if (this.session.player.membership.space === 'rift') {
      return this.dimensionCoordinator.getWorld('rift') ?? this.runtime;
    }
    return this.runtime;
  }

  private collectFuelBlobs(deltaSeconds: number): void {
    if (this.session.player.membership.space === 'rift') {
      const riftRuntime = this.dimensionCoordinator.getWorld('rift');
      if (!riftRuntime) return;
      const result = updateFuelBlobs(
        riftRuntime.world.fuelBlobs,
        this.session.player.position,
        this.playerIsAlive() && this.session.ship.fuel < MAX_FUEL,
        deltaSeconds,
        this.worldSize,
      );
      this.session.ship.collectFuel(result.fuelGain);
      for (const blob of result.collected) riftRuntime.removeFuelBlob(blob);
      return;
    }
    const result = updateFuelBlobs(
      this.session.world.fuelBlobs,
      this.session.player.position,
      this.playerIsAlive() && this.session.ship.fuel < MAX_FUEL,
      deltaSeconds,
      this.worldSize,
    );
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
    const activeSpace = this.dimensionCoordinator.getActiveViewSpace(now);
    const activeWorld =
      activeSpace === 'arcade'
        ? this.runtime
        : (this.dimensionCoordinator.getWorld('rift') ?? this.runtime);
    const position = chooseSafePlayerPositionWithExclusions(
      activeWorld.world.asteroids,
      this.worldSize,
      getBlackHoleSpawnExclusions(activeWorld.world.projectiles),
    );
    this.runtime.detachPlayer();
    this.dimensionCoordinator.getWorld('rift')?.detachPlayer();
    this.session.player.membership = { space: activeSpace };
    this.session.player.position = position;
    this.session.player.velocity = { x: 0, y: 0 };
    activeWorld.attachPlayer(
      this.session.player,
      activeSpace === 'arcade' ? this.playerBody : undefined,
    );
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
    this.getPlayerRuntime().addParticles(
      createThrusterParticles(emitter, exhaustDirection, thrustScale),
    );
  }

  private applyEffect(effect: EffectResult): void {
    this.addParticles(effect.particles);
    if (effect.shakeDurationMs > 0) this.startShake(effect.shakeIntensity, effect.shakeDurationMs);
  }

  private startShake(intensity: number, durationMs: number): void {
    this.sceneRenderer.startShake(intensity, durationMs);
  }

  private showGameOver(): void {
    if (this.gameOverAt === 0) this.gameOverAt = this.time.now;
    this.sceneRenderer.showGameOver(this.worldSize);
  }

  private updateRiftDirector(now: number): void {
    if (
      this.riftDirector.shouldOpenPortal({
        activePortal: this.dimensionCoordinator.getActivePortal() !== null,
        now,
      })
    ) {
      this.openRiftBurst(now);
    }
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    this.runtime.removeProjectile(projectile);
  }

  private addProjectile(projectile: ProjectileEntity): void {
    this.runtime.addProjectile(projectile);
  }

  private removeFuelBlob(blob: FuelBlobEntity): void {
    this.runtime.removeFuelBlob(blob);
  }

  private removeParticle(particle: ParticleEntity): void {
    this.runtime.removeParticle(particle);
  }

  private playerIsAlive(): boolean {
    return this.session.playerAlive;
  }

  private addParticles(particles: ParticleEntity[]): void {
    this.runtime.addParticles(particles);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
    this.sceneRenderer.resize(this.worldSize);
  }

  private disposeRenderEffects(): void {
    if (this.scene.isActive('rift-space')) this.scene.stop('rift-space');
    this.sceneRenderer.destroy();
    this.renderEffects.dispose();
  }
}
