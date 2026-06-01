import Phaser from 'phaser';

import { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS } from '../asteroids/logic';
import { updateAsteroidSplitCollisions } from '../asteroids/splitCollisions';
import type { AsteroidEntity } from '../asteroids/types';
import { destroyAsteroidWithWeapon } from '../combat/asteroidDestruction';
import {
  applyProjectileImpulse,
  damageAsteroid,
  damageAsteroidByAmount,
  resolvePlayerCombat,
  resolveProjectileContactCombat,
  SHIP_ASTEROID_IMPACT_DAMAGE,
} from '../combat/asteroids';
import {
  createAsteroidExplosion,
  createAsteroidImpactDebris,
  createExplosionBurst,
  createShipExplosion,
  createThrusterParticles,
  type EffectResult,
} from '../combat/effects';
import { MatterContacts, type PlayerAsteroidContact } from '../combat/matterContacts';
import {
  getPortalBridgeProjectileAsteroidContacts,
  resolvePortalBridgeAsteroidCollisions,
} from '../combat/portalBridge';
import { circlesOverlap } from '../core/collision';
import { getTimeScale } from '../core/time';
import type { Vector, WorldSize } from '../core/types';
import type { DimensionCoordinator } from '../dimensions/DimensionCoordinator';
import { DimensionDebugOverlay } from '../dimensions/DimensionDebugOverlay';
import { createPortalAsteroidSpawn } from '../dimensions/PortalAsteroidSpawner';
import { PortalDirector } from '../dimensions/PortalDirector';
import { portalApertureContainsCenter } from '../dimensions/portalGeometry';
import { resetDimensionCoordinator } from '../dimensions/runtime';
import type { DimensionCommand, SpaceId } from '../dimensions/types';
import { spawnFuelBlobs, updateFuelBlobs } from '../fuel/blobLogic';
import { FuelBlobViews } from '../fuel/blobViews';
import { FUEL_BLOB_AMOUNT, FUEL_BLOB_RADIUS, MAX_FUEL, SHIELD_RADIUS } from '../fuel/rules';
import type { FuelBlobEntity } from '../fuel/types';
import { ActionReader } from '../input/actions';
import { updateParticles } from '../particles/logic';
import type { ParticleEntity } from '../particles/types';
import { ParticleViews } from '../particles/views';
import { PlayerBody } from '../player/body';
import { PLAYER_COLLISION_RADIUS, PLAYER_MASS } from '../player/config';
import { updatePlayerMotion } from '../player/motion';
import {
  applyBlackHoleGravityToVelocity,
  BLACK_HOLE_ABSORBED_FUEL_BLOBS,
  BLACK_HOLE_FUEL_BLOB_MASS_SCALE,
  BLACK_HOLE_FUEL_GRAVITY_RANGE_MULTIPLIER,
  BLACK_HOLE_FUEL_GRAVITY_STRENGTH_MULTIPLIER,
  getBlackHoleMass,
  getBlackHoleRenderRadius,
  getMatureBlackHoleRadius,
  isMatureBlackHole,
  updateBlackHoles,
} from '../projectiles/blackHoles';
import { ProjectileBodies } from '../projectiles/bodies';
import { updateProjectiles } from '../projectiles/logic';
import type { ProjectileEntity } from '../projectiles/types';
import {
  getArcadeDimensionDebugEnabled,
  getArcadeRiftDebugEnabled,
  getStartingWave,
} from '../runtime/startup';
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
  private dimensionDebug!: DimensionDebugOverlay;
  private dimensionCoordinator!: DimensionCoordinator;
  private riftDirector!: PortalDirector;
  private gameOverAt = 0;
  private lastThrusterAt = 0;
  private nextPortalId = 1;
  private riftSpaceScene: PhaserRiftSpaceScene | null = null;
  private readonly riftDebug = getArcadeRiftDebugEnabled();
  private readonly dimensionDebugEnabled = getArcadeDimensionDebugEnabled();
  private testRiftKey: Phaser.Input.Keyboard.Key | null = null;
  private readonly weaponPolicy: SceneWeaponPolicy = { allowedWeapons: ALL_WEAPONS };

  constructor() {
    super('arcade');
  }

  create(): void {
    this.resetRunFields();
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
    this.dimensionDebug = new DimensionDebugOverlay(this);
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
    this.riftSpaceScene?.setTimeScale(timeScale);
    const deltaSeconds = (delta / 1000) * timeScale;
    this.updateDebugRiftInput();
    this.updateDimensionPortalLifecycle(time);
    this.updatePlayerActions(action, deltaSeconds, time);
    this.updateWorldState(delta, deltaSeconds);
    this.resolveCombat(time, action.shield, deltaSeconds);
    this.collectFuelBlobs(deltaSeconds);
    this.collectPortalBridgeFuelBlobs();
    this.processDimensionPortalTransfers(time);
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
        const riftPlayerBody = this.dimensionCoordinator.requireWorld('rift').getPlayerBody();
        if (!riftPlayerBody) throw new Error('Rift player body is not attached');
        riftPlayerBody.setVelocity(nextVelocity);
      } else {
        this.playerBody.setVelocity(nextVelocity);
      }
    }
    for (const projectile of weaponResult.projectiles) {
      if (playerInRift) {
        this.dimensionCoordinator.requireWorld('rift').addProjectile(projectile);
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
      const riftRuntime = this.dimensionCoordinator.requireWorld('rift');
      const riftPlayerBody = riftRuntime.getPlayerBody();
      if (!riftPlayerBody) throw new Error('Rift player body is not attached');
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
      this.playerBody.setCollisionEnabled(false);
      this.playerBody.updateShieldSensor(false);
    }
    this.applyPortalBridgeTractorBeam(tractorActive);
  }

  private getTractorActive(action: ReturnType<ActionReader['read']>): boolean {
    return isTractorActive(this.weaponPolicy, this.session.ship, {
      firePrimary: action.firePrimary,
      fireSecondary: action.fireSecondary,
      playerActive: this.playerIsAlive(),
      timeDilation: action.timeDilation,
    });
  }

  private applyPortalBridgeTractorBeam(tractorActive: boolean): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (!portal || portal.lifecycle !== 'active') return;
    const riftRuntime = this.dimensionCoordinator.requireWorld('rift');
    if (!portalApertureContainsCenter(portal, this.session.player.position)) return;

    const playerRuntime = this.getPlayerRuntime();
    const oppositeRuntime = playerRuntime.space === 'arcade' ? riftRuntime : this.runtime;
    applyTractorBeam(
      this.session.player.position,
      this.session.player.lastAim,
      oppositeRuntime.world.asteroids.filter((asteroid) =>
        portalApertureContainsCenter(portal, asteroid.position),
      ),
      oppositeRuntime.getAsteroidBodies(),
      tractorActive,
    );
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
    this.resolvePortalBridgeProjectileCombat();
    this.resolvePortalBridgeBlackHoles(deltaSeconds);
    this.applyPlayerCombat(this.getPlayerRuntime(), time, shieldActive);
    this.applyPortalBridgePlayerCombat(time, shieldActive);
  }

  private updateLifecycle(time: number): void {
    this.updateRespawn(time);
    this.updateRiftDirector(time);
  }

  protected renderState(action: ReturnType<ActionReader['read']>, time: number): void {
    const activePortal = this.dimensionCoordinator.getActivePortal();
    const renderablePortals = activePortal ? [activePortal] : [];
    const activeViewSpace = this.dimensionCoordinator.getActiveViewSpace(time);
    this.cameras.main.visible = activeViewSpace === 'arcade';
    this.riftSpaceScene?.setActiveView(activeViewSpace === 'rift');
    this.riftSpaceScene?.setPortals(renderablePortals);
    this.riftSpaceScene?.renderPlayerOverlay({
      action,
      alive: this.session.playerAlive,
      now: time,
      player: this.session.player,
      ship: this.session.ship,
    });
    this.dimensionDebug.render({
      enabled: this.dimensionDebugEnabled,
      runtime: this.runtime,
    });
    this.riftSpaceScene?.renderDimensionDebug({
      enabled: this.dimensionDebugEnabled,
    });
    this.sceneRenderer.setRiftPortals(renderablePortals);
    this.sceneRenderer.setPlayerInRift(this.session.player.membership.space === 'rift');
    this.sceneRenderer.render(time, this.session, action, this.getTractorActive(action));
    if (activeViewSpace === 'arcade') {
      this.renderEffects.render(this.session, time, this.worldSize);
    } else {
      this.renderEffects.setVisible(false);
    }
  }

  private updatePlayer(move: Vector, deltaSeconds: number, now: number): void {
    if (this.session.player.membership.space === 'rift') {
      const riftPlayerBody = this.dimensionCoordinator.requireWorld('rift').getPlayerBody();
      if (!riftPlayerBody) throw new Error('Rift player body is not attached');
      const motion = updatePlayerMotion({
        body: riftPlayerBody,
        deltaSeconds,
        move,
        player: this.session.player,
        ship: this.session.ship,
        world: this.worldSize,
        wrap: true,
      });
      const { thrusting, thrustScale } = motion;
      if (thrusting) this.spawnThrusterParticle(move, now, thrustScale);
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
    if (
      this.testRiftKey &&
      this.riftWorldIsReady() &&
      Phaser.Input.Keyboard.JustDown(this.testRiftKey)
    ) {
      this.openRiftBurst(this.time.now);
    }
  }

  private startRiftSpaceScene(): void {
    const riftScene = this.scene.get('rift-space') as PhaserRiftSpaceScene;
    if (this.scene.isActive('rift-space')) {
      this.bindRiftSpaceScene(riftScene);
      return;
    }
    riftScene.events.once(Phaser.Scenes.Events.CREATE, () => this.bindRiftSpaceScene(riftScene));
    this.scene.launch('rift-space');
  }

  private bindRiftSpaceScene(riftScene: PhaserRiftSpaceScene): void {
    this.riftSpaceScene = riftScene;
    riftScene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.handleRiftSpaceShutdown(riftScene),
    );
    this.sceneRenderer.setPortalDestinationTextureKeyProvider(() => {
      if (this.riftSpaceScene && this.scene.isActive('rift-space')) {
        return this.riftSpaceScene.captureTextureKey();
      }
      return null;
    });
    riftScene.setPortalDestinationTextureKeyProvider(() => this.sceneRenderer.captureTextureKey());
  }

  private updateDimensionPortalLifecycle(now: number): void {
    this.applyDimensionCommands(this.dimensionCoordinator.updatePortalLifecycle(now));
  }

  private processDimensionPortalTransfers(now: number): void {
    this.applyDimensionCommands(
      this.dimensionCoordinator.processPortalTransfers(now, this.worldSize),
    );
  }

  private applyDimensionCommands(commands: DimensionCommand[]): void {
    for (const command of commands) {
      if (command.type === 'spawnPortal') {
        this.dimensionCoordinator.requireWorld('rift').addAsteroids(
          createPortalAsteroidSpawn({
            burstIndex: this.riftDirector.burstCount,
            plan: command.plan,
          }),
        );
      } else if (command.type === 'startCameraTransition') {
        this.startDimensionTransitionEffect();
      }
    }
  }

  private startDimensionTransitionEffect(): void {
    this.cameras.main.flash(220, 103, 232, 249);
    this.riftSpaceScene?.cameras.main.flash(220, 103, 232, 249);
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
    if (!portal || portal.lifecycle !== 'active') return;
    const riftRuntime = this.dimensionCoordinator.requireWorld('rift');

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

  private resolvePortalBridgeProjectileCombat(): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (!portal || portal.lifecycle !== 'active') return;
    const riftRuntime = this.dimensionCoordinator.requireWorld('rift');

    const handledProjectiles = new Set<ProjectileEntity>();
    for (const contact of getPortalBridgeProjectileAsteroidContacts({
      arcadeAsteroids: this.runtime.world.asteroids,
      arcadeProjectiles: this.runtime.world.projectiles,
      getDelta: (from, to) => wrappedDelta(from, to, this.worldSize),
      portal,
      riftAsteroids: riftRuntime.world.asteroids,
      riftProjectiles: riftRuntime.world.projectiles,
    })) {
      if (!handledProjectiles.has(contact.projectile)) {
        handledProjectiles.add(contact.projectile);
        this.applyProjectileAsteroidHit(contact);
      }
    }
  }

  private applyProjectileAsteroidHit(contact: {
    asteroid: AsteroidEntity;
    projectile: ProjectileEntity;
  }): void {
    if (contact.projectile.kind === 'blackHole' || contact.projectile.kind === 'inspectionProbe') {
      return;
    }
    const asteroidRuntime = this.getRuntimeForEntitySpace(contact.asteroid.membership?.space);
    const projectileRuntime = this.getRuntimeForEntitySpace(contact.projectile.membership?.space);
    if (!asteroidRuntime || !projectileRuntime) return;

    applyProjectileImpulse(
      contact.projectile,
      contact.asteroid,
      asteroidRuntime.getAsteroidBodies(),
    );
    projectileRuntime.removeProjectile(contact.projectile);
    if (damageAsteroid(contact.projectile, contact.asteroid)) {
      const destruction = destroyAsteroidWithWeapon(contact.asteroid);
      this.session.awardAsteroidScore(ASTEROIDS[contact.asteroid.tier].points);
      asteroidRuntime.addParticles(destruction.particles);
      asteroidRuntime.addFuelBlobs(destruction.fuelBlobs);
      asteroidRuntime.addAsteroids(destruction.children);
      asteroidRuntime.removeAsteroid(contact.asteroid);
    }
  }

  private applyPlayerCombat(runtime: SpaceWorldRuntime, now: number, shieldActive: boolean): void {
    if (this.session.player.membership.space !== runtime.space) return;
    const playerBody = runtime.getPlayerBody();
    if (!playerBody) return;
    const playerContacts = runtime.getContacts().consumePlayerAsteroidContacts();
    const shieldContacts = runtime.getContacts().consumeShieldAsteroids();
    if (!shieldActive && this.playerIsAlive() && now >= this.session.player.invulnerableUntil) {
      const impact = playerContacts.find((contact) =>
        runtime.world.asteroids.includes(contact.asteroid),
      );
      if (impact) {
        this.applyShipAsteroidImpact(runtime, impact, now);
        return;
      }
    }
    const result = resolvePlayerCombat({
      asteroids: shieldActive ? shieldContacts : [],
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

  private applyShipAsteroidImpact(
    runtime: SpaceWorldRuntime,
    contact: PlayerAsteroidContact,
    now: number,
  ): void {
    const asteroid = contact.asteroid;
    const impactVelocity = {
      x: asteroid.velocity.x - contact.asteroidVelocityBefore.x,
      y: asteroid.velocity.y - contact.asteroidVelocityBefore.y,
    };
    const destroyed = damageAsteroidByAmount(asteroid, SHIP_ASTEROID_IMPACT_DAMAGE);
    if (destroyed) {
      this.session.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
      const destruction = destroyAsteroidWithWeapon(asteroid);
      runtime.addParticles(destruction.particles);
      runtime.addFuelBlobs(destruction.fuelBlobs);
      runtime.addAsteroids(destruction.children);
      runtime.addParticles(createAsteroidImpactDebris(asteroid, impactVelocity).particles);
      runtime.removeAsteroid(asteroid);
    }
    this.killPlayer(now);
  }

  private getRuntimeForEntitySpace(space: SpaceId | undefined): SpaceWorldRuntime | null {
    if (space === 'rift') return this.dimensionCoordinator.requireWorld('rift');
    return this.runtime;
  }

  private resolvePortalBridgeBlackHoles(deltaSeconds: number): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (!portal || portal.lifecycle !== 'active') return;
    const riftRuntime = this.dimensionCoordinator.requireWorld('rift');

    this.applyBlackHoleBridgeForRuntime(this.runtime, riftRuntime, deltaSeconds);
    this.applyBlackHoleBridgeForRuntime(riftRuntime, this.runtime, deltaSeconds);
  }

  private applyBlackHoleBridgeForRuntime(
    sourceRuntime: SpaceWorldRuntime,
    targetRuntime: SpaceWorldRuntime,
    deltaSeconds: number,
  ): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (!portal) return;
    const timeScale = deltaSeconds * 60;
    const blackHoles = sourceRuntime.world.projectiles.filter(
      (projectile) =>
        projectile.kind === 'blackHole' &&
        projectile.collapseStartedAt === null &&
        portalApertureContainsCenter(portal, projectile.position),
    );

    for (const blackHole of blackHoles) {
      const radius = getMatureBlackHoleRadius(blackHole);
      for (const asteroid of targetRuntime.world.asteroids.filter((candidate) =>
        portalApertureContainsCenter(portal, candidate.position),
      )) {
        if (
          applyBlackHoleGravityToVelocity(
            asteroid.velocity,
            asteroid.position,
            blackHole.position,
            radius * 6,
            radius,
            (fromX, fromY, toX, toY) =>
              wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, this.worldSize),
            timeScale,
          )
        ) {
          targetRuntime
            .getAsteroidBodies()
            .get(asteroid)
            .setVelocity(asteroid.velocity.x, asteroid.velocity.y);
        }
      }
      this.applyBridgeBlackHoleFuelGravity(blackHole, targetRuntime, radius, timeScale);
      this.absorbBridgeBlackHoleTargets(blackHole, targetRuntime);
      this.absorbBridgeBlackHolePlayer(blackHole, targetRuntime);
    }
  }

  private applyBridgeBlackHoleFuelGravity(
    blackHole: ProjectileEntity,
    targetRuntime: SpaceWorldRuntime,
    radius: number,
    timeScale: number,
  ): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (!portal) return;
    for (const blob of targetRuntime.world.fuelBlobs.filter((candidate) =>
      portalApertureContainsCenter(portal, candidate.position),
    )) {
      applyBlackHoleGravityToVelocity(
        blob.velocity,
        blob.position,
        blackHole.position,
        radius * BLACK_HOLE_FUEL_GRAVITY_RANGE_MULTIPLIER,
        radius,
        (fromX, fromY, toX, toY) =>
          wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, this.worldSize),
        timeScale,
        BLACK_HOLE_FUEL_GRAVITY_STRENGTH_MULTIPLIER,
      );
    }
  }

  private absorbBridgeBlackHoleTargets(
    blackHole: ProjectileEntity,
    targetRuntime: SpaceWorldRuntime,
  ): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (!portal || !isMatureBlackHole(blackHole)) return;
    const renderRadius = getBlackHoleRenderRadius(blackHole);

    for (const blob of [...targetRuntime.world.fuelBlobs]) {
      if (
        portalApertureContainsCenter(portal, blob.position) &&
        circlesOverlap(
          this.getWrappedDistance(blackHole.position, blob.position),
          renderRadius,
          FUEL_BLOB_RADIUS,
        )
      ) {
        blackHole.absorbedFuel += 1;
        blackHole.blackHoleMass = getBlackHoleMass(blackHole) + BLACK_HOLE_FUEL_BLOB_MASS_SCALE;
        targetRuntime.removeFuelBlob(blob);
      }
    }

    for (const asteroid of [...targetRuntime.world.asteroids]) {
      if (
        portalApertureContainsCenter(portal, asteroid.position) &&
        circlesOverlap(
          this.getWrappedDistance(blackHole.position, asteroid.position),
          renderRadius,
          ASTEROIDS[asteroid.tier].collisionRadius,
        )
      ) {
        blackHole.absorbedFuel += BLACK_HOLE_ABSORBED_FUEL_BLOBS[asteroid.tier];
        blackHole.blackHoleMass =
          getBlackHoleMass(blackHole) +
          BLACK_HOLE_ABSORBED_FUEL_BLOBS[asteroid.tier] * BLACK_HOLE_FUEL_BLOB_MASS_SCALE;
        this.session.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
        targetRuntime.addParticles(createAsteroidExplosion(asteroid, 0.7).particles);
        targetRuntime.removeAsteroid(asteroid);
      }
    }
  }

  private absorbBridgeBlackHolePlayer(
    blackHole: ProjectileEntity,
    targetRuntime: SpaceWorldRuntime,
  ): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (
      !portal ||
      !isMatureBlackHole(blackHole) ||
      this.session.player.membership.space !== targetRuntime.space ||
      !portalApertureContainsCenter(portal, this.session.player.position)
    )
      return;

    if (
      circlesOverlap(
        this.getWrappedDistance(blackHole.position, this.session.player.position),
        getBlackHoleRenderRadius(blackHole),
        PLAYER_COLLISION_RADIUS,
      )
    ) {
      this.killPlayer(this.time.now);
    }
  }

  private getWrappedDistance(from: Vector, to: Vector): number {
    const delta = wrappedDelta(from, to, this.worldSize);
    return Math.hypot(delta.x, delta.y);
  }

  private applyPortalBridgePlayerCombat(now: number, shieldActive: boolean): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (!portal || portal.lifecycle !== 'active') return;
    const riftRuntime = this.dimensionCoordinator.requireWorld('rift');
    if (!portalApertureContainsCenter(portal, this.session.player.position)) return;

    const playerRuntime = this.getPlayerRuntime();
    const oppositeRuntime = playerRuntime.space === 'arcade' ? riftRuntime : this.runtime;
    const playerBody = playerRuntime.getPlayerBody();
    if (!playerBody) return;

    const result = resolvePlayerCombat({
      asteroids: oppositeRuntime.world.asteroids.filter((asteroid) =>
        portalApertureContainsCenter(portal, asteroid.position),
      ),
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
        oppositeRuntime
          .getAsteroidBodies()
          .get(mutation.asteroid)
          .setVelocity(mutation.velocity.x, mutation.velocity.y);
      }
      if (mutation.position)
        oppositeRuntime
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
      const riftRuntime = this.dimensionCoordinator.requireWorld('rift');
      for (const effect of effects) riftRuntime.addParticles(effect.particles);
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
      return this.dimensionCoordinator.requireWorld('rift');
    }
    return this.runtime;
  }

  private collectFuelBlobs(deltaSeconds: number): void {
    if (this.session.player.membership.space === 'rift') {
      const riftRuntime = this.dimensionCoordinator.requireWorld('rift');
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

  private collectPortalBridgeFuelBlobs(): void {
    const portal = this.dimensionCoordinator.getActivePortal();
    if (!portal || portal.lifecycle !== 'active') return;
    const riftRuntime = this.dimensionCoordinator.requireWorld('rift');
    if (!this.playerIsAlive() || this.session.ship.fuel >= MAX_FUEL) return;
    if (!portalApertureContainsCenter(portal, this.session.player.position)) return;

    const playerRuntime = this.getPlayerRuntime();
    const oppositeRuntime = playerRuntime.space === 'arcade' ? riftRuntime : this.runtime;
    const collected = oppositeRuntime.world.fuelBlobs.filter(
      (blob) =>
        portalApertureContainsCenter(portal, blob.position) &&
        circlesOverlap(
          Phaser.Math.Distance.Between(
            this.session.player.position.x,
            this.session.player.position.y,
            blob.position.x,
            blob.position.y,
          ),
          PLAYER_COLLISION_RADIUS,
          FUEL_BLOB_RADIUS,
        ),
    );
    this.session.ship.collectFuel(collected.length * FUEL_BLOB_AMOUNT);
    for (const blob of collected) oppositeRuntime.removeFuelBlob(blob);
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
      activeSpace === 'arcade' ? this.runtime : this.dimensionCoordinator.requireWorld('rift');
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
    if (!this.riftWorldIsReady()) return;
    if (
      this.riftDirector.shouldOpenPortal({
        activePortal: this.dimensionCoordinator.getActivePortal() !== null,
        now,
      })
    ) {
      this.openRiftBurst(now);
    }
  }

  private riftWorldIsReady(): boolean {
    return this.dimensionCoordinator.getWorld('rift') !== null;
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

  private resetRunFields(): void {
    this.gameOverAt = 0;
    this.lastThrusterAt = 0;
    this.nextPortalId = 1;
    this.riftSpaceScene = null;
    this.testRiftKey = null;
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.worldSize = { width: gameSize.width, height: gameSize.height };
    this.sceneRenderer.resize(this.worldSize);
  }

  private disposeRenderEffects(): void {
    this.scale.off('resize', this.handleResize, this);
    if (this.scene.isActive('rift-space')) this.scene.manager.stop('rift-space');
    this.riftSpaceScene = null;
    this.dimensionDebug.destroy();
    this.sceneRenderer.destroy();
    this.renderEffects.dispose();
  }

  private handleRiftSpaceShutdown(scene: PhaserRiftSpaceScene): void {
    if (this.riftSpaceScene === scene) {
      this.riftSpaceScene = null;
    }
  }
}
