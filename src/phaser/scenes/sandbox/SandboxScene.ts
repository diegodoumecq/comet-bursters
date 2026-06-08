import Phaser from 'phaser';

import { AsteroidBodies } from '../../asteroids/bodies';
import { ASTEROIDS } from '../../asteroids/logic';
import { updateAsteroidSplitCollisions } from '../../asteroids/splitCollisions';
import { createAsteroidTextures } from '../../asteroids/textures';
import type { AsteroidEntity } from '../../asteroids/types';
import { getGameAudio } from '../../audio/AudioManager';
import type { SceneAudioDirector } from '../../audio/SceneAudioDirector';
import { destroyAsteroidWithWeapon } from '../../combat/asteroidDestruction';
import {
  damageAsteroidByAmount,
  resolvePlayerCombat,
  resolveProjectileContactCombat,
  SHIP_ASTEROID_IMPACT_DAMAGE,
} from '../../combat/asteroids';
import {
  createAsteroidExplosion,
  createAsteroidImpactDebris,
  createExplosionBurst,
  createShipExplosion,
  createThrusterParticles,
  type EffectResult,
} from '../../combat/effects';
import { resolveProjectileFuelBlobCombatEvents } from '../../combat/fuel';
import { updateFuelBlobCollection } from '../../combat/fuelCollection';
import { MatterContacts, type PlayerAsteroidContact } from '../../combat/matterContacts';
import { applyMatterBodySpec } from '../../core/matterBodySpec';
import { startPerformanceFrame, withPerformanceMeasure } from '../../core/performance';
import { getTimeScale } from '../../core/time';
import type { Vector, WorldSize } from '../../core/types';
import { spawnAsteroidFuelDrops, spawnFuelBlobs, spawnShipFuelDrops } from '../../fuel/blobLogic';
import { FuelBodies } from '../../fuel/bodies';
import { MAX_FUEL, SHIELD_RADIUS } from '../../fuel/rules';
import type { FuelBlobEntity } from '../../fuel/types';
import { ActionReader } from '../../input/actions';
import { mainGameState } from '../../mainGame/state';
import { updateParticles } from '../../particles/logic';
import type { ParticleEntity } from '../../particles/types';
import { ParticleViews } from '../../particles/views';
import { applyPlanetGravity, applyPlanetGravityToFuelBlobs } from '../../planets/gravity';
import { PlanetViews } from '../../planets/views';
import { PlayerBody } from '../../player/body';
import { PLAYER_ACCELERATION, PLAYER_COLLISION_RADIUS } from '../../player/config';
import { PLAYER_DEFINITIONS } from '../../player/definition';
import { updatePlayerMotion } from '../../player/motion';
import { PlayerState } from '../../player/state';
import { createPlayerTexture } from '../../player/textures';
import { updateBlackHoles } from '../../projectiles/blackHoles';
import { ProjectileBodies } from '../../projectiles/bodies';
import { BLACK_HOLE_SOURCE_OVERSCAN } from '../../projectiles/definition';
import { updateProjectiles } from '../../projectiles/logic';
import type { ProjectileEntity } from '../../projectiles/types';
import { enableCanvasOverscan } from '../../runtime/canvasOverscan';
import { getSandboxFogEnabled, getSandboxPerfToggles } from '../../runtime/startup';
import { SANDBOX_WEAPONS, type SceneWeaponPolicy } from '../../weapons/scenePolicy';
import { applyTractorBeam } from '../../weapons/tractorBeam';
import { isTractorActive, updateWeapons } from '../../weapons/use';
import { normalize, wrappedDelta } from '../../world/geometry';
import { GameWorldRuntime } from '../../world/runtime';
import { BaseGameScene } from '../BaseGameScene';
import { SandboxDiscovery } from './discovery';
import {
  Mothership,
  MOTHERSHIP_DOOR_SLIDE_DISTANCE,
  preloadMothershipTextures,
} from './Mothership';
import {
  absorbFuelIntoPlanets,
  collectExtractorFuel,
  updatePlanetFuel,
  type SandboxPlanetEntity,
} from './planetFuel';
import { SandboxRenderEffects } from './SandboxRenderEffects';
import { SandboxRenderer } from './SandboxRenderer';
import { createSandboxStartup } from './sandboxSpawns';
import { SANDBOX_WORLD_CONFIG } from './sandboxWorldConfig';
import { getWrappedDistance } from './screenWrapping';
import {
  positionSandboxWrappedWorldNearPlayer,
  rebaseSandboxWorldAtBounds,
  type SandboxWorldPositioningInput,
} from './worldPositioning';

const WORLD: WorldSize = SANDBOX_WORLD_CONFIG.world;
const SANDBOX_PLAYER_MAX_SPEED = 50;
const SANDBOX_MAX_SPEED_TRAIL_THRESHOLD = SANDBOX_PLAYER_MAX_SPEED * 0.96;
const SANDBOX_MAX_SPEED_TRAIL_INTERVAL_MS = 45;
const SANDBOX_MAX_SPEED_TRAIL_OFFSET = 34;
const SANDBOX_MAX_SPEED_TRAIL_SPREAD = 9;
const PROJECTILE_VISUAL_TELEPORT_THRESHOLD = 180;
const INITIAL_ASTEROIDS = 22;
const RESPAWN_DELAY_MS = 1800;
const STARTING_INSPECTION_PROBES = 300;
const INSPECTION_DURATION_MS = 15000;
const MOTHERSHIP_LAUNCH_CLOSED_MS = 1000;
const MOTHERSHIP_LAUNCH_ACTIVE_MS = 900;
const MOTHERSHIP_LAUNCH_TOTAL_MS = MOTHERSHIP_LAUNCH_CLOSED_MS + MOTHERSHIP_LAUNCH_ACTIVE_MS;
const MOTHERSHIP_LAUNCH_START_SCALE = 0.18;
const MOTHERSHIP_LAUNCH_START_OFFSET: Vector = { x: MOTHERSHIP_DOOR_SLIDE_DISTANCE * 0.55, y: 0 };
const MOTHERSHIP_SPAWN_PLAYER_ROTATION = -Math.PI * 0.5;
const MOTHERSHIP_SPAWN_PLAYER_AIM: Vector = { x: -1, y: 0 };
const PLANET_VIEW_PRELOAD_RADIUS = 3600;

export class PhaserSandboxScene extends BaseGameScene {
  private actions!: ActionReader;
  private sceneRenderer!: SandboxRenderer;
  private playerBody!: PlayerBody;
  private asteroidBodies!: AsteroidBodies;
  private projectileBodies!: ProjectileBodies;
  private fuelBodies!: FuelBodies;
  private particleViews!: ParticleViews;
  private planetViews!: PlanetViews;
  private contacts!: MatterContacts;
  private runtime!: GameWorldRuntime;
  private renderEffects!: SandboxRenderEffects;
  private audioDirector!: SceneAudioDirector;
  private readonly player = new PlayerState();
  private readonly ship = mainGameState.ship;
  private readonly weaponPolicy: SceneWeaponPolicy = { allowedWeapons: SANDBOX_WEAPONS };
  private readonly discovery = new SandboxDiscovery();
  private readonly fogEnabled = getSandboxFogEnabled();
  private readonly perfToggles = getSandboxPerfToggles();
  private planets: SandboxPlanetEntity[] = [];
  private mothership!: Mothership;
  private launchStartedAt = 0;
  private launchDoorOpened = false;
  private controlsEnabled = false;
  private shipCollisionsDisabledForIntro = false;
  private nextProjectileId = 1;
  private inspectionProbes = STARTING_INSPECTION_PROBES;
  private lastThrusterAt = 0;
  private lastMaxSpeedTrailAt = 0;
  private disposeCanvasOverscan: (() => void) | null = null;

  constructor() {
    super('sandbox');
  }

  preload(): void {
    preloadMothershipTextures(this);
  }

  create(): void {
    // Apply this to scenes with moving cameras so screen-space distortions can sample
    // real offscreen pixels from the enlarged source canvas.
    this.disposeCanvasOverscan = enableCanvasOverscan(this.game, BLACK_HOLE_SOURCE_OVERSCAN);
    this.events.once('shutdown', this.disposeCanvasOverscan);
    const perfMarkers = this.perfToggles.markers;
    this.audioDirector = getGameAudio(this).createSceneDirector(this, 'sandbox');
    this.audioDirector.enter();
    this.actions = new ActionReader(this);
    withPerformanceMeasure('sandbox.startup.textures.player', perfMarkers, () => {
      createPlayerTexture(this);
    });
    withPerformanceMeasure('sandbox.startup.textures.asteroids', perfMarkers, () => {
      createAsteroidTextures(this);
    });
    this.asteroidBodies = new AsteroidBodies(this);
    this.projectileBodies = new ProjectileBodies(this);
    this.fuelBodies = new FuelBodies(this);
    this.particleViews = new ParticleViews(this);
    this.planetViews = new PlanetViews(this);
    this.contacts = new MatterContacts(this);
    this.runtime = new GameWorldRuntime(
      this.asteroidBodies,
      this.projectileBodies,
      this.fuelBodies,
      this.particleViews,
      this.contacts,
    );
    const startup = withPerformanceMeasure('sandbox.startup.world', perfMarkers, () =>
      createSandboxStartup(WORLD, INITIAL_ASTEROIDS),
    );
    this.planets = startup.planets;
    const spawnPoint = startup.spawnPoint;
    this.mothership = new Mothership(this, spawnPoint);
    this.playerBody = new PlayerBody(this, spawnPoint, this.player);
    withPerformanceMeasure('sandbox.startup.planetViews', perfMarkers, () => {
      this.planetViews.ensureNear(this.planets, spawnPoint, PLANET_VIEW_PRELOAD_RADIUS);
    });
    this.playerBody.setRotation(MOTHERSHIP_SPAWN_PLAYER_ROTATION);
    applyMatterBodySpec(this.playerBody.body, PLAYER_DEFINITIONS.sandbox.body);
    this.syncPlayerContactBodies();
    this.sceneRenderer = withPerformanceMeasure(
      'sandbox.startup.renderer',
      perfMarkers,
      () =>
        new SandboxRenderer(
          this,
          this.playerBody.body,
          this.weaponPolicy,
          startup.nebulaRegions,
          startup.biomes,
        ),
    );
    this.renderEffects = new SandboxRenderEffects(
      this.game.canvas,
      this.game.canvas.parentElement,
      () => {
        const canvas = this.sceneRenderer.getBackgroundCanvas();
        return canvas ? [canvas] : [];
      },
    );
    this.events.once('shutdown', this.disposeRenderEffects, this);
    this.startLaunchSequence(this.time.now);
    this.sceneRenderer.setPlayerDocked(true);
    this.addAsteroids(startup.asteroids);
    this.cameras.main.startFollow(this.playerBody.body, true, 1, 1);
  }

  protected readFrameInput(): ReturnType<ActionReader['read']> {
    return this.actions.read(this.player.position);
  }

  protected updateState(
    action: ReturnType<ActionReader['read']>,
    time: number,
    delta: number,
  ): void {
    const perf = startPerformanceFrame('sandbox.update.total', this.perfToggles.markers);
    try {
      const timeScale = getTimeScale(action.timeDilation);
      this.matter.world.engine.timing.timeScale = timeScale;
      const deltaSeconds = (delta / 1000) * timeScale;

      perf.startSection('sandbox.update.player');
      this.updatePlayer(action, time, deltaSeconds);

      perf.startSection('sandbox.update.world');
      this.updateWorld(delta, deltaSeconds);

      perf.startSection('sandbox.update.combat');
      this.resolveCombat(time, this.isShieldActive(action), deltaSeconds);

      perf.startSection('sandbox.update.fuelBlobs');
      this.updateFuelBlobs(deltaSeconds);

      perf.startSection('sandbox.update.sceneState');
      this.updateRespawn(time);
      this.updateMothership(time);

      if (this.fogEnabled) {
        perf.startSection('sandbox.update.discovery');
        this.discovery.update(this.player.position, this.planets, WORLD);
      }
    } finally {
      perf.end();
    }
  }

  protected renderState(action: ReturnType<ActionReader['read']>, time: number): void {
    this.syncProjectileVisualsToCamera();
    this.audioDirector.update({
      playerSpeed: Math.hypot(this.player.velocity.x, this.player.velocity.y),
      threatLevel: this.runtime.world.asteroids.length,
      timeDilation: action.timeDilation,
    });
    this.sceneRenderer.render({
      asteroidCount: this.runtime.world.asteroids.length,
      asteroids: this.runtime.world.asteroids,
      now: time,
      player: this.player,
      projectileCount: this.runtime.world.projectiles.length,
      shieldActive: this.isShieldActive(action),
      ship: this.ship,
      timeDilation: action.timeDilation,
      trajectoryPreviewActive: this.controlsEnabled,
      tractorActive: this.getTractorActive(action),
      inspectionProbes: this.inspectionProbes,
      discovery: this.discovery,
      fogEnabled: this.fogEnabled,
      planets: this.planets,
      world: WORLD,
    });
    withPerformanceMeasure('sandbox.render.effects', this.perfToggles.markers, () => {
      this.renderEffects.render({
        camera: this.cameras.main,
        fuelBlobs: this.runtime.world.fuelBlobs,
        now: time,
        planets: this.planets,
        playerPosition: this.player.position,
        projectiles: this.runtime.world.projectiles,
        screen: { width: this.scale.width, height: this.scale.height },
        world: WORLD,
      });
    });
  }

  private updatePlayer(
    action: ReturnType<ActionReader['read']>,
    now: number,
    deltaSeconds: number,
  ): void {
    this.player.updateAim(normalize(action.aim));
    const controlsEnabled = this.controlsEnabled;
    const move = !controlsEnabled || action.timeDilation ? { x: 0, y: 0 } : normalize(action.move);
    this.player.updateThrust(move, false);
    if (this.player.visible && controlsEnabled) {
      const motion = updatePlayerMotion({
        body: this.playerBody,
        deltaSeconds,
        move,
        player: this.player,
        ship: this.ship,
        tuning: {
          acceleration: PLAYER_ACCELERATION,
          maxSpeed: SANDBOX_PLAYER_MAX_SPEED,
        },
        world: WORLD,
        wrap: false,
      });
      if (motion.thrusting) this.spawnThrusterParticle(move, now, motion.thrustScale);
      applyPlanetGravity(
        this.player.velocity,
        this.player.position,
        this.planets,
        WORLD,
        deltaSeconds,
      );
      this.playerBody.setVelocity(this.player.velocity);
      this.spawnMaxSpeedTrail(now);
      rebaseSandboxWorldAtBounds(this.getWorldPositioningInput());
    }
    const weaponResult = updateWeapons({
      action: {
        firePrimary: controlsEnabled && action.firePrimary,
        fireSecondary: controlsEnabled && action.fireSecondary,
        playerActive: controlsEnabled && this.player.visible,
        timeDilation: action.timeDilation,
      },
      deltaSeconds,
      nextProjectileId: this.nextProjectileId,
      now,
      origin: this.player.position,
      player: this.player,
      policy: this.weaponPolicy,
      selectedWeapon: this.sceneRenderer.getSelectedWeapon(this.player.lastAim),
      ship: this.ship,
      shooterVelocity: this.player.velocity,
      inspectionProbes: this.inspectionProbes,
    });
    this.nextProjectileId = weaponResult.nextProjectileId;
    this.ship.assignWeapon('primary', weaponResult.primaryWeapon);
    this.ship.assignWeapon('secondary', weaponResult.secondaryWeapon);
    this.ship.setFuel(weaponResult.fuel);
    this.inspectionProbes = weaponResult.inspectionProbes;
    if (weaponResult.recoil.x !== 0 || weaponResult.recoil.y !== 0) {
      this.playerBody.setVelocity({
        x: this.player.velocity.x + weaponResult.recoil.x,
        y: this.player.velocity.y + weaponResult.recoil.y,
      });
    }
    for (const projectile of weaponResult.projectiles) {
      this.audioDirector.emit({
        position: projectile.position,
        type: 'weaponFired',
        weapon: projectile.kind,
      });
      this.addProjectile(projectile);
    }
    for (const blob of weaponResult.fuelBlobs) {
      this.audioDirector.emit({
        position: blob.position,
        type: 'weaponFired',
        weapon: 'fuelGun',
      });
    }
    this.addFuelBlobs(weaponResult.fuelBlobs);
    applyTractorBeam(
      this.player.position,
      this.player.lastAim,
      this.runtime.world.asteroids,
      this.asteroidBodies,
      weaponResult.tractorActive,
    );
    this.updatePlayerCollisionFilters(action);
  }

  private updateWorld(deltaMs: number, deltaSeconds: number): void {
    for (const asteroid of this.runtime.world.asteroids) {
      applyPlanetGravity(asteroid.velocity, asteroid.position, this.planets, WORLD, deltaSeconds);
      this.asteroidBodies.get(asteroid).setVelocity(asteroid.velocity.x, asteroid.velocity.y);
    }
    this.asteroidBodies.syncAll(this.runtime.world.asteroids);
    updateAsteroidSplitCollisions(this.runtime.world.asteroids, this.asteroidBodies);
    for (const projectile of this.runtime.world.projectiles) {
      if (projectile.kind !== 'blackHole')
        applyPlanetGravity(
          projectile.velocity,
          projectile.position,
          this.planets,
          WORLD,
          deltaSeconds,
        );
      this.projectileBodies
        .get(projectile)
        .setVelocity(projectile.velocity.x, projectile.velocity.y);
    }
    for (const projectile of updateProjectiles(
      this.runtime.world.projectiles,
      this.projectileBodies,
      deltaSeconds,
      WORLD,
      false,
    ))
      this.removeProjectile(projectile);
    updatePlanetFuel(this.planets, this.time.now, deltaSeconds);
    for (const planet of this.planets) this.planetViews.sync(planet);
    for (const particle of updateParticles(this.runtime.world.particles, deltaMs))
      this.removeParticle(particle);
    this.runtime.syncParticles();
    positionSandboxWrappedWorldNearPlayer(this.getWorldPositioningInput());
    this.planetViews.ensureNear(this.planets, this.player.position, PLANET_VIEW_PRELOAD_RADIUS);
  }

  private updateFuelBlobs(deltaSeconds: number): void {
    applyPlanetGravityToFuelBlobs(this.runtime.world.fuelBlobs, this.planets, WORLD, deltaSeconds);
    this.syncFuelBodyVelocities();
    const canCollectFuel = this.player.visible && this.ship.fuel < MAX_FUEL;
    const fuel = updateFuelBlobCollection({
      blobs: this.runtime.world.fuelBlobs,
      canCollect: canCollectFuel,
      contacts: this.contacts,
      deltaSeconds,
      fuelBodies: this.fuelBodies,
      now: this.time.now,
      player: this.player.position,
      world: WORLD,
      wrap: false,
    });
    this.ship.collectFuel(fuel.fuelGain);
    this.ship.collectFuel(
      collectExtractorFuel(
        this.planets,
        this.player.position,
        canCollectFuel,
        this.time.now,
        this.getPlayerCollisionRadius(),
      ),
    );
    for (const blob of fuel.collected) this.removeFuelBlob(blob);
    for (const blob of absorbFuelIntoPlanets(this.runtime.world.fuelBlobs, this.planets, WORLD))
      this.removeFuelBlob(blob);
  }

  private resolveCombat(now: number, shieldActive: boolean, deltaSeconds: number): void {
    this.resolveProjectileCombat();
    this.resolveInspectionProbeHits(now);
    this.resolvePlanetCollisions();
    updateBlackHoles({
      asteroids: this.runtime.world.asteroids,
      asteroidBodies: this.asteroidBodies,
      distance: (fromX, fromY, toX, toY) =>
        getWrappedDistance({ x: fromX, y: fromY }, { x: toX, y: toY }, WORLD),
      fuelBlobs: this.runtime.world.fuelBlobs,
      getDelta: (fromX, fromY, toX, toY) =>
        wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, WORLD),
      now,
      onAsteroidAbsorbed: (asteroid) => {
        this.audioDirector.emit({ position: asteroid.position, type: 'asteroidDestroyed' });
        this.applyEffect(createAsteroidExplosion(asteroid, 0.7));
      },
      onAsteroidRemoved: (asteroid) => this.removeAsteroid(asteroid),
      onBlackHoleRemoved: (projectile) => this.removeProjectile(projectile),
      onFuelBurst: (projectile) => {
        if (projectile.absorbedFuel > 0)
          this.addFuelBlobs(spawnFuelBlobs(projectile.position, projectile.absorbedFuel));
        this.applyEffect(
          createExplosionBurst(
            projectile.position,
            projectile.velocity,
            Math.max(0.6, projectile.absorbedFuel * 0.12),
          ),
        );
      },
      onFuelBlobAbsorbed: (blob) => this.removeFuelBlob(blob),
      onPlayerAbsorbed: () => this.killPlayer(now),
      planets: this.planets,
      player: {
        active: this.player.visible,
        body: this.playerBody.body,
        position: this.player.position,
        velocity: this.player.velocity,
      },
      projectileBodies: this.projectileBodies,
      projectiles: this.runtime.world.projectiles,
      timeScale: deltaSeconds * 60,
    });
    this.syncFuelBodyVelocities();
    this.resolvePlayerAsteroidCombat(now, shieldActive);
  }

  private resolveProjectileCombat(): void {
    this.resolveProjectileFuelBlobCombat();
    const activeProjectiles = new Set(this.runtime.world.projectiles);
    for (const event of resolveProjectileContactCombat(
      this.contacts
        .consumeProjectileAsteroids()
        .filter((contact) => activeProjectiles.has(contact.projectile)),
      this.asteroidBodies,
    )) {
      if (event.type === 'projectileHitAsteroid') {
        this.removeProjectile(event.projectile);
      } else {
        this.destroyAsteroid(event.asteroid, true);
      }
    }
  }

  private resolveProjectileFuelBlobCombat(): void {
    for (const event of resolveProjectileFuelBlobCombatEvents({
      contacts: this.contacts.consumeProjectileFuelBlobs(),
      fuelBlobs: this.runtime.world.fuelBlobs,
      getDistance: (from, to) => getWrappedDistance(from, to, WORLD),
      projectiles: this.runtime.world.projectiles,
    })) {
      this.removeProjectile(event.projectile);
      this.explodeFuelBlobs(event.blobs);
    }
  }

  private explodeFuelBlobs(blobs: FuelBlobEntity[]): void {
    for (const blob of blobs) {
      this.applyEffect(createExplosionBurst(blob.position, blob.velocity, 0.45));
      this.removeFuelBlob(blob);
    }
  }

  private resolvePlayerAsteroidCombat(now: number, shieldActive: boolean): void {
    const playerContacts = this.contacts.consumePlayerAsteroidContacts();
    const shieldContacts = this.contacts.consumeShieldAsteroids();
    if (!shieldActive && this.player.visible && now >= this.player.invulnerableUntil) {
      const impact = playerContacts.find((contact) =>
        this.runtime.world.asteroids.includes(contact.asteroid),
      );
      if (impact) {
        this.applyShipAsteroidImpact(impact, now);
        return;
      }
    }
    const result = resolvePlayerCombat({
      asteroids: shieldActive ? shieldContacts : [],
      fuel: this.ship.fuel,
      getDelta: (from, to) => wrappedDelta(from, to, WORLD),
      invulnerable: now < this.player.invulnerableUntil,
      now,
      playerAlive: this.player.visible,
      playerPosition: this.player.position,
      playerRadius: this.getPlayerCollisionRadius(),
      playerVelocity: this.player.velocity,
      shieldActive,
      shieldRadius: this.getShieldRadius(),
      shieldHitUntil: this.player.shieldHitUntil,
    });
    this.ship.setFuel(result.fuel);
    this.player.shieldHitUntil = result.shieldHitUntil;
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

  private applyShipAsteroidImpact(contact: PlayerAsteroidContact, now: number): void {
    const asteroid = contact.asteroid;
    const impactVelocity = {
      x: asteroid.velocity.x - contact.asteroidVelocityBefore.x,
      y: asteroid.velocity.y - contact.asteroidVelocityBefore.y,
    };
    const destroyed = damageAsteroidByAmount(asteroid, SHIP_ASTEROID_IMPACT_DAMAGE);
    if (destroyed) {
      this.destroyAsteroid(asteroid, true);
      this.applyEffect(createAsteroidImpactDebris(asteroid, impactVelocity));
    }
    this.killPlayer(now);
  }

  private playerCanCollideWithAsteroids(): boolean {
    return this.player.visible && this.time.now >= this.player.invulnerableUntil;
  }

  private isShieldActive(action: ReturnType<ActionReader['read']>): boolean {
    return this.controlsEnabled && action.shield && this.player.visible && this.ship.fuel > 0;
  }

  private updatePlayerCollisionFilters(action: ReturnType<ActionReader['read']>): void {
    if (this.shipCollisionsDisabledForIntro) {
      this.playerBody.setCollisionEnabled(false);
      this.playerBody.updateShieldSensor(false, false);
      return;
    }
    const asteroidCollisionEnabled = this.playerCanCollideWithAsteroids();
    this.playerBody.setAsteroidCollisionEnabled(asteroidCollisionEnabled);
    this.playerBody.updateShieldSensor(this.isShieldActive(action), asteroidCollisionEnabled);
  }

  private resolvePlanetCollisions(): void {
    const asteroidCount = this.runtime.world.asteroids.length;
    for (let index = asteroidCount - 1; index >= 0; index -= 1) {
      const asteroid = this.runtime.world.asteroids[index];
      if (this.collidesWithPlanet(asteroid.position, ASTEROIDS[asteroid.tier].collisionRadius))
        this.destroyAsteroid(asteroid, false);
    }
    const projectileCount = this.runtime.world.projectiles.length;
    for (let index = projectileCount - 1; index >= 0; index -= 1) {
      const projectile = this.runtime.world.projectiles[index];
      if (
        projectile.kind !== 'blackHole' &&
        projectile.kind !== 'inspectionProbe' &&
        this.collidesWithPlanet(projectile.position, 6)
      )
        this.removeProjectile(projectile);
    }
    if (
      this.player.visible &&
      !this.shipCollisionsDisabledForIntro &&
      this.collidesWithPlanet(this.player.position, this.getPlayerCollisionRadius())
    )
      this.killPlayer(this.time.now);
  }

  private resolveInspectionProbeHits(now: number): void {
    const projectileCount = this.runtime.world.projectiles.length;
    for (let index = projectileCount - 1; index >= 0; index -= 1) {
      const projectile = this.runtime.world.projectiles[index];
      if (projectile.kind === 'inspectionProbe') {
        const planet = this.planets.find((candidate) => {
          const radius = candidate.radius + 5;
          return (
            getWrappedDistanceSquared(projectile.position, candidate.position, WORLD) <=
            radius * radius
          );
        });
        if (planet) {
          planet.inspectedUntil = now + INSPECTION_DURATION_MS;
          this.removeProjectile(projectile);
        }
      }
    }
  }

  private collidesWithPlanet(position: Vector, radius: number): boolean {
    return this.planets.some((planet) => {
      const collisionRadius = radius + planet.radius;
      return (
        getWrappedDistanceSquared(position, planet.position, WORLD) <=
        collisionRadius * collisionRadius
      );
    });
  }

  private destroyAsteroid(asteroid: AsteroidEntity, split: boolean): void {
    this.audioDirector.emit({ position: asteroid.position, type: 'asteroidDestroyed' });
    if (split) {
      const destruction = destroyAsteroidWithWeapon(asteroid);
      this.addParticles(destruction.particles);
      this.addFuelBlobs(destruction.fuelBlobs);
      this.addAsteroids(destruction.children);
    } else {
      this.applyEffect(createAsteroidExplosion(asteroid, 1));
      this.addFuelBlobs(spawnAsteroidFuelDrops(asteroid));
    }
    this.removeAsteroid(asteroid);
  }

  private killPlayer(now: number): void {
    if (!this.player.visible) return;
    this.audioDirector.emit({ position: this.player.position, type: 'playerDestroyed' });
    this.player.visible = false;
    this.player.respawnAt = now + RESPAWN_DELAY_MS;
    this.addFuelBlobs(
      spawnShipFuelDrops(this.player.position, this.player.velocity, this.ship.fuel),
    );
    this.ship.setFuel(0);
    for (const effect of createShipExplosion(this.player.position, this.player.velocity))
      this.applyEffect(effect);
    this.playerBody.setVisible(false);
    this.playerBody.setVelocity({ x: 0, y: 0 });
  }

  private updateRespawn(now: number): void {
    if (this.player.visible || now < this.player.respawnAt) return;
    this.startLaunchSequence(now);
    this.playerBody.setRotation(MOTHERSHIP_SPAWN_PLAYER_ROTATION);
    this.playerBody.setVelocity({ x: 0, y: 0 });
    this.playerBody.setVisible(true);
    this.player.visible = true;
    this.player.respawnAt = 0;
    this.player.invulnerableUntil = now + 2200;
    this.ship.resetFuel();
    this.sceneRenderer.setPlayerDocked(true);
  }

  private getTractorActive(action: ReturnType<ActionReader['read']>): boolean {
    if (!this.controlsEnabled) return false;
    return isTractorActive(this.weaponPolicy, this.ship, {
      firePrimary: action.firePrimary,
      fireSecondary: action.fireSecondary,
      playerActive: this.player.visible,
      timeDilation: action.timeDilation,
    });
  }

  private updateMothership(now: number): void {
    if (!this.controlsEnabled) {
      this.updateLaunchSequence(now);
      this.mothership.sync(now);
      this.sceneRenderer.setPlayerDocked(!this.controlsEnabled);
      return;
    }
    const undocked = this.mothership.update(this.player.position, now, WORLD);
    this.sceneRenderer.setPlayerDocked(!undocked);
  }

  private startLaunchSequence(now: number): void {
    this.launchStartedAt = now;
    this.launchDoorOpened = false;
    this.controlsEnabled = false;
    this.shipCollisionsDisabledForIntro = true;
    this.mothership.closeDoor(now);
    this.player.updateAim(MOTHERSHIP_SPAWN_PLAYER_AIM);
    this.playerBody.setScale(MOTHERSHIP_LAUNCH_START_SCALE);
    this.syncPlayerContactBodies();
    this.playerBody.setCollisionEnabled(false);
    this.playerBody.setPosition(this.getLaunchPosition(0));
    this.playerBody.setVelocity({ x: 0, y: 0 });
  }

  private updateLaunchSequence(now: number): void {
    const elapsed = now - this.launchStartedAt;
    this.playerBody.setScale(this.getLaunchScale(elapsed));
    this.syncPlayerContactBodies();
    this.playerBody.setPosition(this.getLaunchPosition(elapsed));
    this.playerBody.setVelocity({ x: 0, y: 0 });
    if (!this.launchDoorOpened && elapsed >= MOTHERSHIP_LAUNCH_CLOSED_MS) {
      this.launchDoorOpened = true;
      this.mothership.startReveal(this.launchStartedAt + MOTHERSHIP_LAUNCH_CLOSED_MS);
    }
    if (elapsed >= MOTHERSHIP_LAUNCH_TOTAL_MS) {
      this.controlsEnabled = true;
      this.shipCollisionsDisabledForIntro = false;
      this.playerBody.setScale(1);
      this.syncPlayerContactBodies();
      this.playerBody.setCollisionEnabled(true);
      this.playerBody.setPosition(this.mothership.getCargoBayPosition());
      this.mothership.releasePlayer();
      this.sceneRenderer.setPlayerDocked(false);
    }
  }

  private getLaunchScale(elapsed: number): number {
    const progress = this.getLaunchProgress(elapsed);
    const eased = progress * progress * (3 - 2 * progress);
    return Phaser.Math.Linear(MOTHERSHIP_LAUNCH_START_SCALE, 1, eased);
  }

  private getLaunchPosition(elapsed: number): Vector {
    const center = this.mothership.getCargoBayPosition();
    const progress = this.getLaunchProgress(elapsed);
    const eased = progress * progress * (3 - 2 * progress);
    return {
      x: center.x + MOTHERSHIP_LAUNCH_START_OFFSET.x * (1 - eased),
      y: center.y + MOTHERSHIP_LAUNCH_START_OFFSET.y * (1 - eased),
    };
  }

  private getLaunchProgress(elapsed: number): number {
    return Phaser.Math.Clamp(
      (elapsed - MOTHERSHIP_LAUNCH_CLOSED_MS) / MOTHERSHIP_LAUNCH_ACTIVE_MS,
      0,
      1,
    );
  }

  private getPlayerCollisionRadius(): number {
    return PLAYER_COLLISION_RADIUS * this.player.scale;
  }

  private getShieldRadius(): number {
    return SHIELD_RADIUS * this.player.scale;
  }

  private syncPlayerContactBodies(): void {
    this.contacts.setPlayer(this.playerBody.body.body);
    this.contacts.setShield(this.playerBody.shieldSensor.body);
  }

  private getWorldPositioningInput(): SandboxWorldPositioningInput {
    return {
      asteroidBodies: this.asteroidBodies,
      fuelBodies: this.fuelBodies,
      mothership: this.mothership,
      now: this.time.now,
      particleViews: this.particleViews,
      planetViews: this.planetViews,
      planets: this.planets,
      player: this.player,
      playerBody: this.playerBody,
      projectileBodies: this.projectileBodies,
      runtime: this.runtime,
      world: WORLD,
    };
  }

  private syncProjectileVisualsToCamera(): void {
    this.projectileBodies.syncVisualsRelativeToCamera({
      camera: this.cameras.main,
      cameraVelocity: this.player.velocity,
      projectiles: this.runtime.world.projectiles,
      teleportThreshold: PROJECTILE_VISUAL_TELEPORT_THRESHOLD,
    });
  }

  private spawnThrusterParticle(move: Vector, now: number, thrustScale: number): void {
    const interval = thrustScale < 1 ? 30 : 10;
    if (now - this.lastThrusterAt < interval) return;
    this.lastThrusterAt = now;
    const exhaustDirection = { x: -move.x, y: -move.y };
    const emitter = {
      x: this.player.position.x + exhaustDirection.x * 30,
      y: this.player.position.y + exhaustDirection.y * 30,
    };
    this.addParticles(createThrusterParticles(emitter, exhaustDirection, thrustScale));
  }

  private spawnMaxSpeedTrail(now: number): void {
    if (now - this.lastMaxSpeedTrailAt < SANDBOX_MAX_SPEED_TRAIL_INTERVAL_MS) return;
    const speed = Math.hypot(this.player.velocity.x, this.player.velocity.y);
    if (speed < SANDBOX_MAX_SPEED_TRAIL_THRESHOLD) return;
    this.lastMaxSpeedTrailAt = now;

    const travelDirection = {
      x: this.player.velocity.x / speed,
      y: this.player.velocity.y / speed,
    };
    const exhaustDirection = {
      x: -travelDirection.x,
      y: -travelDirection.y,
    };
    const side = {
      x: -travelDirection.y,
      y: travelDirection.x,
    };
    const center = {
      x: this.player.position.x + exhaustDirection.x * SANDBOX_MAX_SPEED_TRAIL_OFFSET,
      y: this.player.position.y + exhaustDirection.y * SANDBOX_MAX_SPEED_TRAIL_OFFSET,
    };
    this.addParticles([
      ...createThrusterParticles(
        {
          x: center.x + side.x * SANDBOX_MAX_SPEED_TRAIL_SPREAD,
          y: center.y + side.y * SANDBOX_MAX_SPEED_TRAIL_SPREAD,
        },
        exhaustDirection,
        0.45,
      ),
      ...createThrusterParticles(
        {
          x: center.x - side.x * SANDBOX_MAX_SPEED_TRAIL_SPREAD,
          y: center.y - side.y * SANDBOX_MAX_SPEED_TRAIL_SPREAD,
        },
        exhaustDirection,
        0.45,
      ),
    ]);
  }

  private applyEffect(effect: EffectResult): void {
    this.addParticles(effect.particles);
  }

  private addAsteroids(asteroids: AsteroidEntity[]): void {
    this.runtime.addAsteroids(asteroids);
  }

  private addProjectile(projectile: ProjectileEntity): void {
    this.runtime.addProjectile(projectile);
  }

  private addFuelBlobs(blobs: FuelBlobEntity[]): void {
    this.runtime.addFuelBlobs(blobs);
  }

  private addParticles(particles: ParticleEntity[]): void {
    this.runtime.addParticles(particles);
  }

  private removeAsteroid(asteroid: AsteroidEntity): void {
    this.runtime.removeAsteroid(asteroid);
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    this.runtime.removeProjectile(projectile);
  }

  private removeFuelBlob(blob: FuelBlobEntity): void {
    this.runtime.removeFuelBlob(blob);
  }

  private syncFuelBodyVelocities(): void {
    for (const blob of this.runtime.world.fuelBlobs) {
      this.fuelBodies.setVelocity(blob, blob.velocity);
    }
  }

  private removeParticle(particle: ParticleEntity): void {
    this.runtime.removeParticle(particle);
  }

  private disposeRenderEffects(): void {
    this.audioDirector.exit();
    this.renderEffects.dispose();
    this.disposeCanvasOverscan = null;
  }
}

function getWrappedDistanceSquared(from: Vector, to: Vector, world: WorldSize): number {
  let x = to.x - from.x;
  if (x > world.width * 0.5) x -= world.width;
  if (x < -world.width * 0.5) x += world.width;
  let y = to.y - from.y;
  if (y > world.height * 0.5) y -= world.height;
  if (y < -world.height * 0.5) y += world.height;
  return x * x + y * y;
}
