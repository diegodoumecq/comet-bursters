import Phaser from 'phaser';

import { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS } from '../asteroids/logic';
import { updateAsteroidSplitCollisions } from '../asteroids/splitCollisions';
import type { AsteroidEntity } from '../asteroids/types';
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
import { circlesOverlap } from '../core/collision';
import { getTimeScale } from '../core/time';
import type { Vector, WorldSize } from '../core/types';
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
import { updatePlayerMotion, updatePlayerStateMotion } from '../player/motion';
import { updateBlackHoles } from '../projectiles/blackHoles';
import { ProjectileBodies } from '../projectiles/bodies';
import { updateProjectiles } from '../projectiles/logic';
import type { ProjectileEntity } from '../projectiles/types';
import { updateRiftBlackHoles } from '../rifts/blackHoles';
import { disposeRiftSourceSpaceTransientState } from '../rifts/closureRules';
import { ArcadeRiftDirector } from '../rifts/director';
import { releaseExitedRiftFuelBlobs } from '../rifts/fuelTransfer';
import { projectRiftLocalVectorToScene } from '../rifts/geometry';
import { releaseExitedRiftParticles } from '../rifts/particleTransfer';
import { getPortalTransferDecision } from '../rifts/portalTransfer';
import { resolveRiftProjectileCombat } from '../rifts/projectileCombat';
import { shouldEnterRift } from '../rifts/sceneMembership';
import {
  createRiftBurst,
  getRenderableRiftPortals,
  getRiftAsteroidTransitions,
  syncRiftLifecycle,
  updateRiftSourceSpace,
} from '../rifts/sourceSpace';
import {
  arcadeToPortalLocal,
  arcadeVelocityToRift,
  riftToArcade,
  riftVelocityToArcade,
} from '../rifts/transforms';
import type { RiftAsteroidTransition, RiftSourceAsteroid, RiftSourceSpace } from '../rifts/types';
import { getArcadeRiftDebugEnabled, getStartingWave } from '../runtime/startup';
import { PROJECTILES } from '../weapons/config';
import { ALL_WEAPONS, type SceneWeaponPolicy } from '../weapons/scenePolicy';
import { applyTractorBeam } from '../weapons/tractorBeam';
import { isTractorActive, updateWeapons } from '../weapons/use';
import { normalize, wrappedDelta } from '../world/geometry';
import { GameWorldRuntime } from '../world/runtime';
import { ArcadeRenderEffects } from './arcade/ArcadeRenderEffects';
import { ArcadeRenderer } from './arcade/ArcadeRenderer';
import { ArcadeRunState } from './arcade/arcadeRunState';
import {
  chooseSafePlayerPositionWithExclusions,
  getBlackHoleSpawnExclusions,
  getPlayerSpawnCircle,
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
  private runtime!: GameWorldRuntime;
  private renderEffects!: ArcadeRenderEffects;
  private riftDirector!: ArcadeRiftDirector;
  private gameOverAt = 0;
  private lastThrusterAt = 0;
  private readonly riftSourceSpaces: RiftSourceSpace[] = [];
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
    this.riftDirector = new ArcadeRiftDirector(startingIntensity);
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
    this.runtime = new GameWorldRuntime(
      this.asteroidBodies,
      this.projectileBodies,
      this.fuelBlobViews,
      this.particleViews,
      this.contacts,
      this.session.world,
    );
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
    this.updateRiftSourceSpaces(deltaSeconds);
    this.resolveCombat(time, action.shield, deltaSeconds);
    this.collectFuelBlobs(deltaSeconds);
    this.updateLifecycle(time);
  }

  private updatePlayerActions(
    action: ReturnType<ActionReader['read']>,
    deltaSeconds: number,
    time: number,
  ): void {
    const riftPlayerSourceSpace = this.getPlayerRiftSourceSpace();
    const aim = this.getPlayerControlVector(action.aim, riftPlayerSourceSpace);
    this.session.player.updateAim(normalize(aim));
    const move = action.timeDilation
      ? { x: 0, y: 0 }
      : normalize(this.getPlayerControlVector(action.move, riftPlayerSourceSpace));
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
      if (riftPlayerSourceSpace) {
        this.session.player.velocity = nextVelocity;
      } else {
        this.playerBody.setVelocity(nextVelocity);
      }
    }
    for (const projectile of weaponResult.projectiles) {
      if (riftPlayerSourceSpace) {
        projectile.membership = { portalId: riftPlayerSourceSpace.portal.id, space: 'rift' };
        riftPlayerSourceSpace.projectiles.push(projectile);
      } else {
        this.addProjectile(projectile);
      }
    }
    const tractorActive = weaponResult.tractorActive;
    if (!riftPlayerSourceSpace) {
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
    this.applyProjectileCombat();
    updateBlackHoles({
      asteroids: this.session.world.asteroids,
      asteroidBodies: this.asteroidBodies,
      distance: (fromX, fromY, toX, toY) => {
        const delta = wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, this.worldSize);
        return Math.hypot(delta.x, delta.y);
      },
      fuelBlobs: this.session.world.fuelBlobs,
      getDelta: (fromX, fromY, toX, toY) =>
        wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, this.worldSize),
      now: time,
      onAsteroidAbsorbed: (asteroid) => {
        this.session.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
        this.applyEffect(createAsteroidExplosion(asteroid, 0.7));
      },
      onAsteroidRemoved: (asteroid) => this.removeAsteroid(asteroid),
      onBlackHoleRemoved: (projectile) => this.removeProjectile(projectile),
      onFuelBurst: (projectile) => {
        if (projectile.absorbedFuel > 0) {
          this.addFuelBlobs(
            spawnFuelBlobs(projectile.position, projectile.velocity, projectile.absorbedFuel),
          );
        }
        this.applyEffect(
          createExplosionBurst(
            projectile.position,
            projectile.velocity,
            Math.max(0.6, projectile.absorbedFuel * 0.12),
          ),
        );
      },
      onFuelBlobAbsorbed: (blob) => this.removeFuelBlob(blob),
      onPlayerAbsorbed: () => this.killPlayer(time),
      player: {
        active: this.playerIsAlive() && !this.playerIsInRift(),
        body: this.playerBody.body,
        position: this.session.player.position,
        velocity: this.session.player.velocity,
      },
      projectileBodies: this.projectileBodies,
      projectiles: this.session.world.projectiles.filter(
        (projectile) => projectile.membership?.space !== 'rift',
      ),
      timeScale: deltaSeconds * 60,
    });
    const sourceSpace = this.getPlayerRiftSourceSpace();
    if (sourceSpace) {
      this.applyRiftPlayerCombat(sourceSpace, time, shieldActive);
    } else {
      this.applyPlayerCombat(time, shieldActive);
    }
  }

  private updateLifecycle(time: number): void {
    this.updateRespawn(time);
    this.updateRiftDirector(time);
  }

  protected renderState(action: ReturnType<ActionReader['read']>, time: number): void {
    const renderableRiftPortals = getRenderableRiftPortals(this.riftSourceSpaces);
    this.riftSpaceScene?.setPortals(renderableRiftPortals);
    this.riftSpaceScene?.setSourceSpaces(this.riftSourceSpaces);
    this.sceneRenderer.setRiftPortals(renderableRiftPortals);
    this.sceneRenderer.setPlayerInRift(this.playerIsInRift());
    this.sceneRenderer.render(time, this.session, action, this.getTractorActive(action));
    this.renderEffects.render(this.session, time, this.worldSize);
  }

  private updatePlayer(move: Vector, deltaSeconds: number, now: number): void {
    const sourceSpace = this.getPlayerRiftSourceSpace();
    if (sourceSpace) {
      const motion = updatePlayerStateMotion({
        deltaSeconds,
        move,
        player: this.session.player,
        ship: this.session.ship,
        world: sourceSpace.size,
        wrap: false,
      });
      const { thrusting, thrustScale } = motion;
      if (thrusting) this.spawnRiftThrusterParticle(sourceSpace, move, now, thrustScale);
      this.releasePlayerFromRiftIfNeeded(sourceSpace);
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
    const sourceSpace = this.getPlayerRiftSourceSpace();
    return sourceSpace
      ? riftToArcade(sourceSpace.portal, this.session.player.position)
      : this.session.player.position;
  }

  private getPlayerControlVector(vector: Vector, sourceSpace: RiftSourceSpace | null): Vector {
    return sourceSpace ? arcadeVelocityToRift(sourceSpace.portal, vector) : vector;
  }

  private openRiftBurst(now: number): void {
    const asteroidCount = this.riftDirector.recordBurst(now);
    this.session.burstCount = this.riftDirector.burstCount;
    const burst = createRiftBurst({
      asteroidCount,
      burstIndex: this.riftDirector.burstCount,
      exclusions: [getPlayerSpawnCircle(this.getPlayerActionOrigin())],
      now,
      world: this.worldSize,
    });
    this.riftSourceSpaces.push(burst.sourceSpace);
    this.sceneRenderer.addRift(burst.portal);
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
    this.sceneRenderer.setRiftSourceCanvasProvider(() => {
      if (this.riftSpaceScene) return this.riftSpaceScene.getRenderCanvas();
      throw new Error('Rift space scene is not available');
    });
  }

  private updateRiftSourceSpaces(deltaSeconds: number): void {
    if (!this.riftSourceSpaces.some((candidate) => candidate.state !== 'disposed')) {
      this.releaseRiftSceneEntities();
    }
    this.absorbArcadeAsteroidsIntoRifts();
    this.updateRiftMembershipForSceneEntities();
    this.updateRiftProjectiles(deltaSeconds);
    this.resolveRiftBlackHoles(deltaSeconds);
    this.resolveRiftProjectileCombat();
    for (const sourceSpace of this.riftSourceSpaces) {
      updateRiftSourceSpace({
        deltaSeconds,
        now: this.time.now,
        sourceSpace,
      });
      this.addFuelBlobs(releaseExitedRiftFuelBlobs(sourceSpace));
      this.addParticles(releaseExitedRiftParticles(sourceSpace));
      const transitions = getRiftAsteroidTransitions(sourceSpace.asteroids, sourceSpace.portal);
      for (const transition of transitions) {
        if (transition.status === 'emerged') {
          this.releaseRiftAsteroid(transition);
        }
      }
    }
    this.removeDisposedRiftSourceSpaces(this.time.now);
  }

  private releaseRiftSceneEntities(): void {
    const sourceSpace = this.getPlayerRiftSourceSpace();
    if (this.session.player.membership.space === 'rift') {
      const position = sourceSpace
        ? riftToArcade(sourceSpace.portal, this.session.player.position)
        : this.session.player.position;
      const velocity = sourceSpace
        ? riftVelocityToArcade(sourceSpace.portal, this.session.player.velocity)
        : this.session.player.velocity;
      this.session.player.membership = { space: 'arcade' };
      this.session.player.position = position;
      this.session.player.velocity = velocity;
      this.playerBody.setPosition(position);
      this.playerBody.setVelocity(velocity);
      this.playerBody.setVisible(this.playerIsAlive());
      this.playerBody.setCollisionEnabled(true);
    }
    for (const sourceSpace of this.riftSourceSpaces) {
      if (sourceSpace.player === this.session.player) sourceSpace.player = null;
    }
  }

  private absorbArcadeAsteroidsIntoRifts(): void {
    const sourceSpace = this.riftSourceSpaces.find((candidate) => candidate.state !== 'disposed');
    if (!sourceSpace) return;
    for (const asteroid of [...this.session.world.asteroids]) {
      if (!this.findRiftSourceAsteroid(asteroid)) {
        const body = this.asteroidBodies.get(asteroid);
        const decision = getPortalTransferDecision(
          {
            membership: asteroid.membership ?? { space: 'arcade' },
            position: { x: body.x, y: body.y },
            radius: ASTEROIDS[asteroid.tier].radius,
            velocity: { x: body.body.velocity.x, y: body.body.velocity.y },
          },
          sourceSpace.portal,
        );
        if (decision?.space === 'rift') {
          asteroid.membership = decision.membership;
          asteroid.velocity = decision.velocity;
          asteroid.splitGroupId = 10_000 + sourceSpace.portal.id;
          sourceSpace.asteroids.push({
            asteroid,
            portalId: sourceSpace.portal.id,
            sourcePosition: decision.position,
            sourceSpaceId: sourceSpace.id,
          });
          this.runtime.removeAsteroid(asteroid);
        }
      }
    }
  }

  private updateRiftMembershipForSceneEntities(): void {
    const sourceSpace = this.riftSourceSpaces.find((candidate) => candidate.state !== 'disposed');
    if (!sourceSpace) return;
    for (const projectile of [...this.session.world.projectiles]) {
      this.updateProjectileRiftMembership(projectile, sourceSpace);
    }
    this.updatePlayerRiftMembership(sourceSpace);
  }

  private updateProjectileRiftMembership(
    projectile: ProjectileEntity,
    sourceSpace: RiftSourceSpace,
  ): void {
    const body = this.projectileBodies.get(projectile);
    const radius = PROJECTILES[projectile.kind].radius;
    const localPosition = arcadeToPortalLocal(sourceSpace.portal, { x: body.x, y: body.y });
    const localVelocity = arcadeVelocityToRift(sourceSpace.portal, {
      x: body.body.velocity.x,
      y: body.body.velocity.y,
    });
    if (
      shouldEnterRift({
        inRift: false,
        localPosition,
        localVelocity,
        portal: sourceSpace.portal,
        radius,
      })
    ) {
      const decision = getPortalTransferDecision(
        {
          membership: projectile.membership ?? { space: 'arcade' },
          position: { x: body.x, y: body.y },
          radius,
          velocity: { x: body.body.velocity.x, y: body.body.velocity.y },
        },
        sourceSpace.portal,
      );
      if (decision?.space === 'rift') {
        projectile.membership = decision.membership;
        projectile.position = decision.position;
        projectile.velocity = decision.velocity;
        this.runtime.removeProjectile(projectile);
        sourceSpace.projectiles.push(projectile);
      }
    }
  }

  private updateRiftProjectiles(deltaSeconds: number): void {
    const frameScale = deltaSeconds * 60;
    for (const sourceSpace of this.riftSourceSpaces) {
      for (const projectile of [...sourceSpace.projectiles]) {
        this.updateActiveRiftProjectile(sourceSpace, projectile, frameScale, deltaSeconds);
      }
    }
  }

  private updateActiveRiftProjectile(
    sourceSpace: RiftSourceSpace,
    projectile: ProjectileEntity,
    frameScale: number,
    deltaSeconds: number,
  ): void {
    projectile.ageMs += deltaSeconds * 1000;
    if (projectile.kind !== 'blackHole' && projectile.ageMs >= projectile.lifetimeMs) {
      this.removeRiftProjectile(sourceSpace, projectile);
      return;
    }
    if (projectile.kind === 'blackHole' && projectile.collapseStartedAt !== null) return;
    projectile.position = {
      x: projectile.position.x + projectile.velocity.x * frameScale,
      y: projectile.position.y + projectile.velocity.y * frameScale,
    };
    const decision = getPortalTransferDecision(
      {
        membership: projectile.membership ?? { portalId: sourceSpace.portal.id, space: 'rift' },
        position: projectile.position,
        radius: PROJECTILES[projectile.kind].radius,
        velocity: projectile.velocity,
      },
      sourceSpace.portal,
    );
    if (decision?.space === 'arcade') {
      projectile.membership = decision.membership;
      projectile.position = decision.position;
      projectile.velocity = decision.velocity;
      this.removeRiftProjectile(sourceSpace, projectile);
      this.addProjectile(projectile);
    }
  }

  private burstRiftBlackHole(sourceSpace: RiftSourceSpace, projectile: ProjectileEntity): void {
    if (projectile.absorbedFuel > 0) {
      this.addRiftFuelBlobs(
        sourceSpace,
        spawnFuelBlobs(projectile.position, projectile.velocity, projectile.absorbedFuel),
      );
    }
    const burst = createExplosionBurst(
      projectile.position,
      projectile.velocity,
      Math.max(0.6, projectile.absorbedFuel * 0.12),
    );
    this.addRiftParticles(sourceSpace, burst.particles);
  }

  private resolveRiftBlackHoles(deltaSeconds: number): void {
    for (const sourceSpace of this.riftSourceSpaces) {
      const events = updateRiftBlackHoles({
        sourceSpace,
        timeScale: deltaSeconds * 60,
      });
      for (const event of events) {
        if (event.type === 'asteroidAbsorbed') {
          const asteroid = event.sourceAsteroid.asteroid;
          asteroid.position = { ...event.sourceAsteroid.sourcePosition };
          this.session.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
          this.addRiftParticles(sourceSpace, createAsteroidExplosion(asteroid, 0.7).particles);
        } else if (event.type === 'fuelBurst') {
          this.burstRiftBlackHole(sourceSpace, event.projectile);
        } else {
          this.killPlayer(this.time.now);
        }
      }
    }
  }

  private resolveRiftProjectileCombat(): void {
    for (const sourceSpace of this.riftSourceSpaces) {
      if (sourceSpace.projectiles.length > 0 && sourceSpace.asteroids.length > 0) {
        const events = resolveRiftProjectileCombat({
          projectiles: sourceSpace.projectiles,
          sourceAsteroids: sourceSpace.asteroids,
        });
        for (const event of events) {
          if (event.type === 'projectileHitAsteroid') {
            this.removeRiftProjectile(sourceSpace, event.projectile);
          } else {
            this.destroyRiftSourceAsteroidWithProjectile(sourceSpace, event.sourceAsteroid);
          }
        }
      }
    }
  }

  private destroyRiftSourceAsteroidWithProjectile(
    sourceSpace: RiftSourceSpace,
    sourceAsteroid: RiftSourceAsteroid,
  ): void {
    const asteroid = sourceAsteroid.asteroid;
    asteroid.position = { ...sourceAsteroid.sourcePosition };
    const destruction = destroyAsteroidWithWeapon(asteroid);
    this.session.awardAsteroidScore(ASTEROIDS[asteroid.tier].points);
    this.addRiftAsteroidChildren(sourceSpace, sourceAsteroid, destruction.children);
    this.addRiftFuelBlobs(sourceSpace, destruction.fuelBlobs);
    this.addRiftParticles(sourceSpace, destruction.particles);
    this.removeRiftSourceAsteroidByAsteroid(asteroid);
  }

  private updatePlayerRiftMembership(sourceSpace: RiftSourceSpace): void {
    if (!this.playerIsAlive()) {
      this.session.player.membership = { space: 'arcade' };
      sourceSpace.player = null;
      return;
    }
    if (this.playerIsInRift()) return;

    const decision = getPortalTransferDecision(
      {
        membership: this.session.player.membership,
        position: this.session.player.position,
        radius: PLAYER_COLLISION_RADIUS,
        velocity: this.session.player.velocity,
      },
      sourceSpace.portal,
    );
    if (decision?.space === 'rift') {
      this.session.player.membership = decision.membership;
      this.session.player.position = decision.position;
      this.session.player.velocity = decision.velocity;
      sourceSpace.player = this.session.player;
      this.playerBody.setVisible(false);
      this.playerBody.setCollisionEnabled(false);
      this.playerBody.updateShieldSensor(false);
    }
  }

  private releasePlayerFromRiftIfNeeded(sourceSpace: RiftSourceSpace): void {
    const decision = getPortalTransferDecision(
      {
        membership: this.session.player.membership,
        position: this.session.player.position,
        radius: PLAYER_COLLISION_RADIUS,
        velocity: this.session.player.velocity,
      },
      sourceSpace.portal,
    );
    if (decision?.space === 'arcade') {
      sourceSpace.player = null;
      this.session.player.membership = decision.membership;
      this.session.player.position = decision.position;
      this.session.player.velocity = decision.velocity;
      this.playerBody.setPosition(decision.position);
      this.playerBody.setVelocity(decision.velocity);
      this.playerBody.setRotation(this.session.player.rotation);
      this.playerBody.setVisible(true);
      this.playerBody.setCollisionEnabled(true);
    }
  }

  private releaseRiftAsteroid(transition: RiftAsteroidTransition): void {
    const sourceAsteroid = transition.sourceAsteroid;
    const decision = getPortalTransferDecision(
      {
        membership: sourceAsteroid.asteroid.membership ?? {
          portalId: transition.portal.id,
          space: 'rift',
        },
        position: sourceAsteroid.sourcePosition,
        radius: ASTEROIDS[sourceAsteroid.asteroid.tier].radius,
        velocity: sourceAsteroid.asteroid.velocity,
      },
      transition.portal,
    );
    sourceAsteroid.asteroid.membership = decision?.membership ?? { space: 'arcade' };
    sourceAsteroid.asteroid.position = decision?.position ?? transition.scenePosition;
    sourceAsteroid.asteroid.velocity =
      decision?.velocity ??
      projectRiftLocalVectorToScene(transition.portal, sourceAsteroid.asteroid.velocity);
    delete sourceAsteroid.asteroid.splitGroupId;
    this.removeRiftSourceAsteroid(transition);
    this.addAsteroids([sourceAsteroid.asteroid]);
  }

  private applyProjectileCombat(): void {
    const activeProjectiles = new Set(this.session.world.projectiles);
    for (const event of resolveProjectileContactCombat(
      this.contacts
        .consumeProjectileAsteroids()
        .filter((contact) => activeProjectiles.has(contact.projectile)),
      this.asteroidBodies,
    )) {
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
      asteroids: shieldActive
        ? this.contacts.consumeShieldAsteroids()
        : this.contacts.consumePlayerAsteroids(),
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
    this.playerBody.setVelocity(result.playerVelocity);
    for (const mutation of result.asteroidMutations) {
      if (mutation.velocity) {
        mutation.asteroid.velocity = mutation.velocity;
        this.asteroidBodies
          .get(mutation.asteroid)
          .setVelocity(mutation.velocity.x, mutation.velocity.y);
      }
      if (mutation.position)
        this.asteroidBodies
          .get(mutation.asteroid)
          .setPosition(mutation.position.x, mutation.position.y);
    }
    if (result.playerDestroyed) this.killPlayer(now);
  }

  private applyRiftPlayerCombat(
    sourceSpace: RiftSourceSpace,
    now: number,
    shieldActive: boolean,
  ): void {
    for (const sourceAsteroid of sourceSpace.asteroids) {
      sourceAsteroid.asteroid.position = { ...sourceAsteroid.sourcePosition };
    }
    const result = resolvePlayerCombat({
      asteroids: sourceSpace.asteroids.map((sourceAsteroid) => sourceAsteroid.asteroid),
      fuel: this.session.ship.fuel,
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
    this.session.player.velocity = result.playerVelocity;
    for (const mutation of result.asteroidMutations) {
      const sourceAsteroid = sourceSpace.asteroids.find(
        (candidate) => candidate.asteroid === mutation.asteroid,
      );
      if (sourceAsteroid) {
        if (mutation.position) sourceAsteroid.sourcePosition = mutation.position;
        if (mutation.velocity) mutation.asteroid.velocity = mutation.velocity;
      }
    }
    if (result.playerDestroyed) this.killPlayer(now);
  }

  private killPlayer(now: number): void {
    if (!this.playerIsAlive()) return;
    const sourceSpace = this.getPlayerRiftSourceSpace();
    this.session.destroyPlayer(now);
    const effects = createShipExplosion(this.session.player.position, this.session.player.velocity);
    if (sourceSpace) {
      for (const effect of effects) this.addRiftParticles(sourceSpace, effect.particles);
      sourceSpace.player = null;
    } else {
      for (const effect of effects) this.applyEffect(effect);
    }
    this.playerBody.setVisible(false);
  }

  private playerCanCollideWithAsteroids(): boolean {
    return this.playerIsAlive() && this.time.now >= this.session.player.invulnerableUntil;
  }

  private collectFuelBlobs(deltaSeconds: number): void {
    const sourceSpace = this.getPlayerRiftSourceSpace();
    if (sourceSpace) {
      this.collectRiftFuelBlobs(sourceSpace);
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

  private collectRiftFuelBlobs(sourceSpace: RiftSourceSpace): void {
    if (!this.playerIsAlive() || this.session.ship.fuel >= MAX_FUEL) return;
    let collected = 0;
    for (let index = sourceSpace.fuelBlobs.length - 1; index >= 0; index -= 1) {
      const blob = sourceSpace.fuelBlobs[index];
      const distance = Math.hypot(
        this.session.player.position.x - blob.position.x,
        this.session.player.position.y - blob.position.y,
      );
      if (circlesOverlap(distance, PLAYER_COLLISION_RADIUS, FUEL_BLOB_RADIUS)) {
        sourceSpace.fuelBlobs.splice(index, 1);
        collected += 1;
      }
    }
    this.session.ship.collectFuel(collected * FUEL_BLOB_AMOUNT);
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
    const position = chooseSafePlayerPositionWithExclusions(
      this.session.world.asteroids,
      this.worldSize,
      getBlackHoleSpawnExclusions(this.session.world.projectiles),
    );
    for (const sourceSpace of this.riftSourceSpaces) {
      if (sourceSpace.player === this.session.player) sourceSpace.player = null;
    }
    this.session.player.membership = { space: 'arcade' };
    this.playerBody.setPosition(position);
    this.playerBody.setVelocity({ x: 0, y: 0 });
    this.playerBody.setVisible(true);
    this.playerBody.setCollisionEnabled(true);
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

  private spawnRiftThrusterParticle(
    sourceSpace: RiftSourceSpace,
    move: Vector,
    now: number,
    thrustScale: number,
  ): void {
    const interval = thrustScale < 1 ? 30 : 10;
    if (now - this.lastThrusterAt < interval) return;
    this.lastThrusterAt = now;
    const exhaustDirection = { x: -move.x, y: -move.y };
    const emitter = {
      x: this.session.player.position.x + exhaustDirection.x * 30,
      y: this.session.player.position.y + exhaustDirection.y * 30,
    };
    this.addRiftParticles(
      sourceSpace,
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
    this.removeDisposedRiftSourceSpaces(now);
    if (
      this.riftDirector.shouldOpenBurst({
        activeAsteroids: this.session.world.asteroids.length,
        now,
        openRifts: this.riftSourceSpaces.length,
        stagedAsteroids: this.getStagedRiftAsteroidCount(),
      })
    ) {
      this.openRiftBurst(now);
    }
  }

  private getStagedRiftAsteroidCount(): number {
    return this.riftSourceSpaces.reduce(
      (count, sourceSpace) => count + sourceSpace.asteroids.length,
      0,
    );
  }

  private removeRiftSourceAsteroid(transition: RiftAsteroidTransition): void {
    for (const sourceSpace of this.riftSourceSpaces) {
      const index = sourceSpace.asteroids.indexOf(transition.sourceAsteroid);
      if (index >= 0) sourceSpace.asteroids.splice(index, 1);
    }
  }

  private removeRiftSourceAsteroidByAsteroid(asteroid: AsteroidEntity): void {
    for (const sourceSpace of this.riftSourceSpaces) {
      for (let index = sourceSpace.asteroids.length - 1; index >= 0; index -= 1) {
        if (sourceSpace.asteroids[index].asteroid === asteroid) {
          sourceSpace.asteroids.splice(index, 1);
        }
      }
    }
  }

  private findRiftSourceAsteroid(asteroid: AsteroidEntity): RiftSourceAsteroid | null {
    for (const sourceSpace of this.riftSourceSpaces) {
      const sourceAsteroid = sourceSpace.asteroids.find(
        (candidate) => candidate.asteroid === asteroid,
      );
      if (sourceAsteroid) return sourceAsteroid;
    }
    return null;
  }

  private addRiftAsteroidChildren(
    sourceSpace: RiftSourceSpace,
    sourceAsteroid: RiftSourceAsteroid,
    children: AsteroidEntity[],
  ): void {
    if (children.length === 0) return;
    for (const child of children) {
      child.membership = { portalId: sourceSpace.portal.id, space: 'rift' };
      child.position = { ...sourceAsteroid.asteroid.position };
      child.splitGroupId = sourceAsteroid.asteroid.splitGroupId;
      sourceSpace.asteroids.push({
        asteroid: child,
        portalId: sourceSpace.portal.id,
        sourcePosition: { ...sourceAsteroid.sourcePosition },
        sourceSpaceId: sourceSpace.id,
      });
    }
  }

  private addRiftFuelBlobs(sourceSpace: RiftSourceSpace, blobs: FuelBlobEntity[]): void {
    for (const blob of blobs) {
      blob.membership = { portalId: sourceSpace.portal.id, space: 'rift' };
      sourceSpace.fuelBlobs.push(blob);
    }
  }

  private addRiftParticles(sourceSpace: RiftSourceSpace, particles: ParticleEntity[]): void {
    for (const particle of particles) {
      particle.membership = { portalId: sourceSpace.portal.id, space: 'rift' };
      sourceSpace.particles.push(particle);
    }
  }

  private removeDisposedRiftSourceSpaces(now: number): void {
    for (let index = this.riftSourceSpaces.length - 1; index >= 0; index -= 1) {
      syncRiftLifecycle(this.riftSourceSpaces[index], now);
      if (this.riftSourceSpaces[index].state === 'disposed') {
        disposeRiftSourceSpaceTransientState(this.riftSourceSpaces[index]);
        this.riftSourceSpaces.splice(index, 1);
      }
    }
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    this.runtime.removeProjectile(projectile);
  }

  private removeRiftProjectile(sourceSpace: RiftSourceSpace, projectile: ProjectileEntity): void {
    const index = sourceSpace.projectiles.indexOf(projectile);
    if (index >= 0) sourceSpace.projectiles.splice(index, 1);
  }

  private addProjectile(projectile: ProjectileEntity): void {
    this.runtime.addProjectile(projectile);
  }

  private removeAsteroid(asteroid: AsteroidEntity): void {
    this.removeRiftSourceAsteroidByAsteroid(asteroid);
    this.runtime.removeAsteroid(asteroid);
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

  private playerIsInRift(): boolean {
    return this.getPlayerRiftSourceSpace() !== null;
  }

  private getPlayerRiftSourceSpace(): RiftSourceSpace | null {
    return (
      this.riftSourceSpaces.find((sourceSpace) => sourceSpace.player === this.session.player) ??
      null
    );
  }

  private addAsteroids(asteroids: AsteroidEntity[]): void {
    this.runtime.addAsteroids(asteroids);
  }

  private addFuelBlobs(blobs: FuelBlobEntity[]): void {
    this.runtime.addFuelBlobs(blobs);
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
