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
import { getTimeScale } from '../core/time';
import type { Vector, WorldSize } from '../core/types';
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
import { updatePlayerMotion } from '../player/motion';
import { updateBlackHoles } from '../projectiles/blackHoles';
import { ProjectileBodies } from '../projectiles/bodies';
import { updateProjectiles } from '../projectiles/logic';
import type { ProjectileEntity } from '../projectiles/types';
import { ArcadeRiftDirector } from '../rifts/director';
import {
  projectRiftLocalVectorToScene,
  projectRiftSourceToScene,
  projectSceneVectorToRiftLocal,
} from '../rifts/geometry';
import {
  getScenePositionInRiftSpace,
  shouldEnterRift,
  shouldExitRift,
} from '../rifts/sceneMembership';
import {
  createRiftBurst,
  getRenderableRiftPortals,
  getRiftProjections,
  syncRiftLifecycle,
  updateRiftSourceSpace,
} from '../rifts/sourceSpace';
import type {
  RiftPortal,
  RiftProjection,
  RiftSceneProjection,
  RiftSourceAsteroid,
  RiftSourceSpace,
} from '../rifts/types';
import { getArcadeRiftDebugEnabled, getStartingWave } from '../runtime/startup';
import { ALL_WEAPONS, type SceneWeaponPolicy } from '../weapons/scenePolicy';
import { PROJECTILES } from '../weapons/config';
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
  private riftPlayerPortal: RiftPortal | null = null;
  private riftProjections: RiftProjection[] = [];
  private readonly riftProjectiles = new Map<ProjectileEntity, RiftPortal>();
  private riftSceneProjections: RiftSceneProjection[] = [];
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
    return this.actions.read(this.session.player.position);
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
    this.hideRiftAsteroidBodies();
    this.collectFuelBlobs(deltaSeconds);
    this.updateLifecycle(time);
  }

  private updatePlayerActions(
    action: ReturnType<ActionReader['read']>,
    deltaSeconds: number,
    time: number,
  ): void {
    this.session.player.updateAim(normalize(action.aim));
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
      this.playerBody.setVelocity({
        x: velocity.x + weaponResult.recoil.x,
        y: velocity.y + weaponResult.recoil.y,
      });
    }
    for (const projectile of weaponResult.projectiles) this.addProjectile(projectile);
    const tractorActive = weaponResult.tractorActive;
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
        active: this.playerIsAlive(),
        body: this.playerBody.body,
        position: this.session.player.position,
        velocity: this.session.player.velocity,
      },
      projectileBodies: this.projectileBodies,
      projectiles: this.session.world.projectiles,
      timeScale: deltaSeconds * 60,
    });
    this.applyPlayerCombat(time, shieldActive);
    this.syncRiftSourceVelocitiesFromBodies();
  }

  private updateLifecycle(time: number): void {
    this.updateRespawn(time);
    this.updateRiftDirector(time);
  }

  protected renderState(action: ReturnType<ActionReader['read']>, time: number): void {
    this.sceneRenderer.setRiftPortals(getRenderableRiftPortals(this.riftSourceSpaces));
    this.sceneRenderer.setRiftProjections(this.riftProjections);
    this.sceneRenderer.setRiftSceneProjections(this.riftSceneProjections);
    this.sceneRenderer.setPlayerInRift(this.riftPlayerPortal !== null);
    this.sceneRenderer.render(time, this.session, action, this.getTractorActive(action));
    this.renderEffects.render(this.session, time, this.worldSize);
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

  private openRiftBurst(now: number): void {
    const asteroidCount = this.riftDirector.recordBurst(now);
    this.session.burstCount = this.riftDirector.burstCount;
    const burst = createRiftBurst({
      asteroidCount,
      burstIndex: this.riftDirector.burstCount,
      exclusions: [getPlayerSpawnCircle(this.session.player.position)],
      now,
      world: this.worldSize,
    });
    this.riftSourceSpaces.push(burst.sourceSpace);
    this.addAsteroids(burst.sourceSpace.asteroids.map((sourceAsteroid) => sourceAsteroid.asteroid));
    for (const sourceAsteroid of burst.sourceSpace.asteroids) {
      this.syncRiftAsteroidBody(sourceAsteroid, burst.sourceSpace.portal, false);
    }
    this.sceneRenderer.addRift(burst.portal);
  }

  private updateDebugRiftInput(): void {
    if (this.testRiftKey && Phaser.Input.Keyboard.JustDown(this.testRiftKey)) {
      this.openRiftBurst(this.time.now);
    }
  }

  private updateRiftSourceSpaces(deltaSeconds: number): void {
    this.riftProjections = [];
    this.riftSceneProjections = [];
    if (!this.riftSourceSpaces.some((candidate) => candidate.state !== 'disposed')) {
      this.releaseRiftSceneEntities();
    }
    this.absorbArcadeAsteroidsIntoRifts();
    this.updateRiftMembershipForSceneEntities();
    for (const sourceSpace of this.riftSourceSpaces) {
      const asteroidsBeforeUpdate = new Set(
        sourceSpace.asteroids.map((sourceAsteroid) => sourceAsteroid.asteroid),
      );
      updateRiftSourceSpace({
        deltaSeconds,
        now: this.time.now,
        sourceSpace,
      });
      this.removeCulledRiftAsteroids(sourceSpace, asteroidsBeforeUpdate);
      const projections = getRiftProjections(sourceSpace.asteroids, sourceSpace.portal);
      for (const projection of projections) {
        if (projection.status === 'emerged') {
          this.releaseRiftAsteroid(projection);
        } else {
          this.syncRiftAsteroidBody(
            projection.sourceAsteroid,
            projection.portal,
            false,
            projection.scenePosition,
          );
          this.riftProjections.push(projection);
        }
      }
    }
    this.buildRiftSceneProjections();
    this.removeDisposedRiftSourceSpaces(this.time.now);
  }

  private removeCulledRiftAsteroids(
    sourceSpace: RiftSourceSpace,
    asteroidsBeforeUpdate: Set<AsteroidEntity>,
  ): void {
    for (const asteroid of asteroidsBeforeUpdate) {
      if (!sourceSpace.asteroids.some((sourceAsteroid) => sourceAsteroid.asteroid === asteroid)) {
        if (this.session.world.asteroids.includes(asteroid)) this.removeAsteroid(asteroid);
      }
    }
  }

  private releaseRiftSceneEntities(): void {
    for (const projectile of this.riftProjectiles.keys()) {
      if (this.session.world.projectiles.includes(projectile)) {
        this.projectileBodies.setVisible(projectile, true);
      }
    }
    this.riftProjectiles.clear();
    this.riftPlayerPortal = null;
  }

  private absorbArcadeAsteroidsIntoRifts(): void {
    const sourceSpace = this.riftSourceSpaces.find((candidate) => candidate.state !== 'disposed');
    if (!sourceSpace) return;
    for (const asteroid of this.session.world.asteroids) {
      if (!this.findRiftSourceAsteroid(asteroid)) {
        const body = this.asteroidBodies.get(asteroid);
        const localPosition = getScenePositionInRiftSpace(sourceSpace.portal, {
          x: body.x,
          y: body.y,
        });
        const localVelocity = projectSceneVectorToRiftLocal(sourceSpace.portal, {
          x: body.body.velocity.x,
          y: body.body.velocity.y,
        });
        if (
          shouldEnterRift({
            inRift: false,
            localPosition,
            localVelocity,
            portal: sourceSpace.portal,
            radius: ASTEROIDS[asteroid.tier].radius,
          })
        ) {
          asteroid.velocity = localVelocity;
          asteroid.splitGroupId = 10_000 + sourceSpace.portal.id;
          this.asteroidBodies.syncCollisionFilter(asteroid);
          sourceSpace.asteroids.push({
            asteroid,
            portalId: sourceSpace.portal.id,
            sourcePosition: {
              x: sourceSpace.portal.sourcePosition.x + localPosition.x,
              y: sourceSpace.portal.sourcePosition.y + localPosition.y,
            },
            sourceSpaceId: sourceSpace.id,
          });
          this.syncRiftAsteroidBody(
            sourceSpace.asteroids[sourceSpace.asteroids.length - 1],
            sourceSpace.portal,
            false,
            { x: body.x, y: body.y },
          );
        }
      }
    }
  }

  private updateRiftMembershipForSceneEntities(): void {
    const sourceSpace = this.riftSourceSpaces.find((candidate) => candidate.state !== 'disposed');
    if (!sourceSpace) return;
    for (const projectile of this.session.world.projectiles) {
      this.updateProjectileRiftMembership(projectile, sourceSpace.portal);
    }
    this.updatePlayerRiftMembership(sourceSpace.portal);
  }

  private updateProjectileRiftMembership(projectile: ProjectileEntity, portal: RiftPortal): void {
    if (projectile.kind === 'blackHole') return;
    const body = this.projectileBodies.get(projectile);
    const localPosition = getScenePositionInRiftSpace(portal, { x: body.x, y: body.y });
    const localVelocity = projectSceneVectorToRiftLocal(portal, {
      x: body.body.velocity.x,
      y: body.body.velocity.y,
    });
    const radius = PROJECTILES[projectile.kind].radius;
    const inRift = this.riftProjectiles.has(projectile);
    if (shouldEnterRift({ inRift, localPosition, localVelocity, portal, radius })) {
      this.riftProjectiles.set(projectile, portal);
      this.projectileBodies.setVisible(projectile, false);
    } else if (shouldExitRift({ inRift, localPosition, localVelocity, portal, radius })) {
      this.riftProjectiles.delete(projectile);
      this.projectileBodies.setVisible(projectile, true);
    } else if (inRift) {
      this.projectileBodies.setVisible(projectile, false);
    }
  }

  private updatePlayerRiftMembership(portal: RiftPortal): void {
    if (!this.playerIsAlive()) {
      this.riftPlayerPortal = null;
      return;
    }
    const localPosition = getScenePositionInRiftSpace(portal, this.session.player.position);
    const localVelocity = projectSceneVectorToRiftLocal(portal, this.session.player.velocity);
    const inRift = this.riftPlayerPortal !== null;
    if (
      shouldEnterRift({
        inRift,
        localPosition,
        localVelocity,
        portal,
        radius: PLAYER_COLLISION_RADIUS,
      })
    ) {
      this.riftPlayerPortal = portal;
    } else if (
      shouldExitRift({
        inRift,
        localPosition,
        localVelocity,
        portal,
        radius: PLAYER_COLLISION_RADIUS,
      })
    ) {
      this.riftPlayerPortal = null;
    }
  }

  private buildRiftSceneProjections(): void {
    for (const [projectile, portal] of this.riftProjectiles) {
      if (this.session.world.projectiles.includes(projectile)) {
        this.riftSceneProjections.push({
          kind: 'projectile',
          portal,
          projectileKind: projectile.kind,
          radius: PROJECTILES[projectile.kind].radius,
          rotation: projectile.angle,
          scenePosition: projectile.position,
        });
      }
    }
    if (this.riftPlayerPortal) {
      this.riftSceneProjections.push({
        kind: 'player',
        portal: this.riftPlayerPortal,
        rotation: this.session.player.rotation,
        scale: this.session.player.scale,
        scenePosition: this.session.player.position,
      });
    }
  }

  private releaseRiftAsteroid(projection: RiftProjection): void {
    const sourceAsteroid = projection.sourceAsteroid;
    sourceAsteroid.asteroid.position = projection.scenePosition;
    sourceAsteroid.asteroid.velocity = projectRiftLocalVectorToScene(
      projection.portal,
      sourceAsteroid.asteroid.velocity,
    );
    delete sourceAsteroid.asteroid.splitGroupId;
    this.syncRiftAsteroidBody(sourceAsteroid, projection.portal, true, projection.scenePosition);
    this.asteroidBodies.syncCollisionFilter(sourceAsteroid.asteroid);
    this.sceneRenderer.removeRiftAsteroid(projection);
    this.removeRiftSourceAsteroid(projection);
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
        const sourceAsteroid = this.findRiftSourceAsteroid(event.asteroid);
        if (sourceAsteroid) {
          this.addRiftAsteroidChildrenFromSource(sourceAsteroid, destruction.children);
        } else {
          this.addAsteroids(destruction.children);
        }
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

  private killPlayer(now: number): void {
    if (!this.playerIsAlive()) return;
    this.session.destroyPlayer(now);
    for (const effect of createShipExplosion(
      this.session.player.position,
      this.session.player.velocity,
    ))
      this.applyEffect(effect);
    this.playerBody.setVisible(false);
  }

  private playerCanCollideWithAsteroids(): boolean {
    return this.playerIsAlive() && this.time.now >= this.session.player.invulnerableUntil;
  }

  private collectFuelBlobs(deltaSeconds: number): void {
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
    const position = chooseSafePlayerPositionWithExclusions(
      this.session.world.asteroids,
      this.worldSize,
      getBlackHoleSpawnExclusions(this.session.world.projectiles),
    );
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

  private syncRiftAsteroidBody(
    sourceAsteroid: RiftSourceAsteroid,
    portal: RiftSourceSpace['portal'],
    visible: boolean,
    scenePosition = projectRiftSourceToScene(portal, sourceAsteroid.sourcePosition),
  ): void {
    const sceneVelocity = projectRiftLocalVectorToScene(portal, sourceAsteroid.asteroid.velocity);
    const body = this.asteroidBodies.get(sourceAsteroid.asteroid);
    body.setPosition(scenePosition.x, scenePosition.y);
    body.setVelocity(sceneVelocity.x, sceneVelocity.y);
    this.asteroidBodies.setVisible(sourceAsteroid.asteroid, visible);
    sourceAsteroid.asteroid.position = scenePosition;
  }

  private syncRiftSourceVelocitiesFromBodies(): void {
    for (const sourceSpace of this.riftSourceSpaces) {
      for (const sourceAsteroid of sourceSpace.asteroids) {
        const body = this.asteroidBodies.get(sourceAsteroid.asteroid);
        sourceAsteroid.asteroid.velocity = projectSceneVectorToRiftLocal(sourceSpace.portal, {
          x: body.body.velocity.x,
          y: body.body.velocity.y,
        });
      }
    }
  }

  private hideRiftAsteroidBodies(): void {
    for (const sourceSpace of this.riftSourceSpaces) {
      for (const sourceAsteroid of sourceSpace.asteroids) {
        this.asteroidBodies.setVisible(sourceAsteroid.asteroid, false);
      }
    }
  }

  private removeRiftSourceAsteroid(projection: RiftProjection): void {
    for (const sourceSpace of this.riftSourceSpaces) {
      const index = sourceSpace.asteroids.indexOf(projection.sourceAsteroid);
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
      const sourceAsteroid = sourceSpace.asteroids.find((candidate) => candidate.asteroid === asteroid);
      if (sourceAsteroid) return sourceAsteroid;
    }
    return null;
  }

  private findRiftSourceSpace(sourceAsteroid: RiftSourceAsteroid): RiftSourceSpace | null {
    return (
      this.riftSourceSpaces.find((candidate) => candidate.id === sourceAsteroid.sourceSpaceId) ??
      null
    );
  }

  private addRiftAsteroidChildrenFromSource(
    sourceAsteroid: RiftSourceAsteroid,
    children: AsteroidEntity[],
  ): void {
    if (children.length === 0) return;
    const sourceSpace = this.findRiftSourceSpace(sourceAsteroid);
    if (!sourceSpace) {
      this.addAsteroids(children);
      return;
    }
    for (const child of children) {
      child.position = { ...sourceAsteroid.asteroid.position };
      child.velocity = projectSceneVectorToRiftLocal(sourceSpace.portal, child.velocity);
      child.splitGroupId = sourceAsteroid.asteroid.splitGroupId;
      sourceSpace.asteroids.push({
        asteroid: child,
        portalId: sourceSpace.portal.id,
        sourcePosition: { ...sourceAsteroid.sourcePosition },
        sourceSpaceId: sourceSpace.id,
      });
    }
    this.addAsteroids(children);
    for (const child of children) {
      const childSourceAsteroid = this.findRiftSourceAsteroid(child);
      if (childSourceAsteroid) {
        this.syncRiftAsteroidBody(childSourceAsteroid, sourceSpace.portal, false);
      }
    }
  }

  private removeDisposedRiftSourceSpaces(now: number): void {
    for (let index = this.riftSourceSpaces.length - 1; index >= 0; index -= 1) {
      syncRiftLifecycle(this.riftSourceSpaces[index], now);
      if (this.riftSourceSpaces[index].state === 'disposed') {
        this.riftSourceSpaces.splice(index, 1);
      }
    }
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    this.riftProjectiles.delete(projectile);
    this.runtime.removeProjectile(projectile);
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
    this.sceneRenderer.destroy();
    this.renderEffects.dispose();
  }
}
