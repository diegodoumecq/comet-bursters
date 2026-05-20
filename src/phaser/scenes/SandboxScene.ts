import Phaser from 'phaser';

import { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS, createAsteroid } from '../asteroids/logic';
import { updateAsteroidSplitCollisions } from '../asteroids/splitCollisions';
import { createAsteroidTextures } from '../asteroids/textures';
import type { AsteroidEntity, AsteroidTier } from '../asteroids/types';
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
import { spawnAsteroidFuelDrops, spawnFuelBlobs, updateFuelBlobs } from '../fuel/blobLogic';
import { FuelBlobViews } from '../fuel/blobViews';
import { MAX_FUEL } from '../fuel/rules';
import type { FuelBlobEntity } from '../fuel/types';
import { ActionReader } from '../input/actions';
import { mainGameState } from '../mainGame/state';
import { updateParticles } from '../particles/logic';
import type { ParticleEntity } from '../particles/types';
import { ParticleViews } from '../particles/views';
import { applyPlanetGravity } from '../planets/gravity';
import { PlanetViews } from '../planets/views';
import { PlayerBody } from '../player/body';
import { updatePlayerMotion } from '../player/motion';
import { PlayerState } from '../player/state';
import { createPlayerTexture } from '../player/textures';
import { updateBlackHoles } from '../projectiles/blackHoles';
import { ProjectileBodies } from '../projectiles/bodies';
import { updateProjectiles } from '../projectiles/logic';
import type { ProjectileEntity } from '../projectiles/types';
import { SANDBOX_WEAPONS, type SceneWeaponPolicy } from '../weapons/scenePolicy';
import { applyTractorBeam } from '../weapons/tractorBeam';
import { isTractorActive, updateWeapons } from '../weapons/use';
import { normalize, wrappedDelta } from '../world/geometry';
import { GameWorldRuntime } from '../world/runtime';
import { BaseGameScene } from './BaseGameScene';
import { SandboxDiscovery } from './sandbox/discovery';
import { Mothership, preloadMothershipTextures } from './sandbox/Mothership';
import {
  absorbFuelIntoPlanets,
  collectExtractorFuel,
  updatePlanetFuel,
  type SandboxPlanetEntity,
} from './sandbox/planetFuel';
import { createSandboxPlanets } from './sandbox/sandboxPlanets';
import { SandboxRenderEffects } from './sandbox/SandboxRenderEffects';
import { SandboxRenderer } from './sandbox/SandboxRenderer';
import { getWrappedDistance } from './sandbox/screenWrapping';
import { keepMovingEntitiesNearPlayer, rebaseWorldAroundPlayer } from './sandbox/worldPositioning';

const WORLD: WorldSize = { width: 12000, height: 12000 };
const INITIAL_ASTEROIDS = 22;
const RESPAWN_DELAY_MS = 1800;
const STARTING_INSPECTION_PROBES = 300;
const INSPECTION_DURATION_MS = 15000;

export class PhaserSandboxScene extends BaseGameScene {
  private actions!: ActionReader;
  private sceneRenderer!: SandboxRenderer;
  private playerBody!: PlayerBody;
  private asteroidBodies!: AsteroidBodies;
  private projectileBodies!: ProjectileBodies;
  private fuelBlobViews!: FuelBlobViews;
  private particleViews!: ParticleViews;
  private planetViews!: PlanetViews;
  private contacts!: MatterContacts;
  private runtime!: GameWorldRuntime;
  private renderEffects!: SandboxRenderEffects;
  private readonly player = new PlayerState();
  private readonly ship = mainGameState.ship;
  private readonly weaponPolicy: SceneWeaponPolicy = { allowedWeapons: SANDBOX_WEAPONS };
  private readonly discovery = new SandboxDiscovery();
  private planets: SandboxPlanetEntity[] = [];
  private mothership!: Mothership;
  private nextProjectileId = 1;
  private inspectionProbes = STARTING_INSPECTION_PROBES;
  private lastThrusterAt = 0;

  constructor() {
    super('sandbox');
  }

  preload(): void {
    preloadMothershipTextures(this);
  }

  create(): void {
    this.actions = new ActionReader(this);
    createPlayerTexture(this);
    createAsteroidTextures(this);
    this.drawBackground();
    this.asteroidBodies = new AsteroidBodies(this);
    this.projectileBodies = new ProjectileBodies(this);
    this.fuelBlobViews = new FuelBlobViews();
    this.particleViews = new ParticleViews(this);
    this.planetViews = new PlanetViews(this);
    this.contacts = new MatterContacts(this);
    this.runtime = new GameWorldRuntime(
      this.asteroidBodies,
      this.projectileBodies,
      this.fuelBlobViews,
      this.particleViews,
      this.contacts,
    );
    this.planets = createSandboxPlanets(WORLD);
    for (const planet of this.planets) this.planetViews.add(planet);
    const spawnPoint = this.chooseSafeSpawn();
    this.mothership = new Mothership(this, spawnPoint);
    this.playerBody = new PlayerBody(this, spawnPoint, this.player);
    this.playerBody.setRotation(Math.PI * 0.5);
    this.playerBody.body.setMass(18);
    this.playerBody.body.setFrictionAir(0);
    this.contacts.setPlayer(this.playerBody.body.body);
    this.contacts.setShield(this.playerBody.shieldSensor.body);
    this.sceneRenderer = new SandboxRenderer(this, this.playerBody.body, this.weaponPolicy);
    this.renderEffects = new SandboxRenderEffects(this.game.canvas, this.game.canvas.parentElement);
    this.events.once('shutdown', this.disposeRenderEffects, this);
    this.mothership.startReveal(this.time.now);
    this.sceneRenderer.setPlayerDocked(true);
    this.addAsteroids(createInitialAsteroids());
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
    const timeScale = getTimeScale(action.timeDilation);
    this.matter.world.engine.timing.timeScale = timeScale;
    const deltaSeconds = (delta / 1000) * timeScale;
    this.updatePlayer(action, time, deltaSeconds);
    this.updateWorld(delta, deltaSeconds);
    this.resolveCombat(time, action.shield, deltaSeconds);
    this.updateRespawn(time);
    this.updateMothership(time);
    this.discovery.update(this.player.position, this.planets, WORLD);
  }

  protected renderState(action: ReturnType<ActionReader['read']>, time: number): void {
    this.sceneRenderer.render({
      asteroidCount: this.runtime.world.asteroids.length,
      now: time,
      player: this.player,
      projectileCount: this.runtime.world.projectiles.length,
      shieldActive: action.shield,
      ship: this.ship,
      timeDilation: action.timeDilation,
      tractorActive: this.getTractorActive(action),
      inspectionProbes: this.inspectionProbes,
      discovery: this.discovery,
      planets: this.planets,
      world: WORLD,
    });
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
  }

  private updatePlayer(
    action: ReturnType<ActionReader['read']>,
    now: number,
    deltaSeconds: number,
  ): void {
    this.player.updateAim(normalize(action.aim));
    const move = normalize(action.move);
    this.player.updateThrust(move, false);
    if (this.player.visible) {
      const motion = updatePlayerMotion({
        body: this.playerBody,
        deltaSeconds,
        move,
        player: this.player,
        ship: this.ship,
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
      rebaseWorldAroundPlayer(this.getWorldPositioningInput());
    }
    const weaponResult = updateWeapons({
      action: {
        firePrimary: action.firePrimary,
        fireSecondary: action.fireSecondary,
        playerActive: this.player.visible,
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
    for (const projectile of weaponResult.projectiles) this.addProjectile(projectile);
    applyTractorBeam(
      this.player.position,
      this.player.lastAim,
      this.runtime.world.asteroids,
      this.asteroidBodies,
      weaponResult.tractorActive,
    );
    this.playerBody.updateShieldSensor(action.shield && this.player.visible && this.ship.fuel > 0);
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
    for (const blob of this.runtime.world.fuelBlobs) {
      applyPlanetGravity(blob.velocity, blob.position, this.planets, WORLD, deltaSeconds);
    }
    const fuel = updateFuelBlobs(
      this.runtime.world.fuelBlobs,
      this.player.position,
      this.player.visible && this.ship.fuel < MAX_FUEL,
      deltaSeconds,
      WORLD,
      false,
    );
    this.ship.collectFuel(fuel.fuelGain);
    this.ship.collectFuel(
      collectExtractorFuel(
        this.planets,
        this.player.position,
        this.player.visible && this.ship.fuel < MAX_FUEL,
        this.time.now,
      ),
    );
    this.runtime.syncFuelBlobs();
    for (const blob of fuel.collected) this.removeFuelBlob(blob);
    for (const blob of absorbFuelIntoPlanets(this.runtime.world.fuelBlobs, this.planets, WORLD))
      this.removeFuelBlob(blob);
    for (const particle of updateParticles(this.runtime.world.particles, deltaMs))
      this.removeParticle(particle);
    this.runtime.syncParticles();
    keepMovingEntitiesNearPlayer(this.getWorldPositioningInput());
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
      getDelta: (fromX, fromY, toX, toY) =>
        wrappedDelta({ x: fromX, y: fromY }, { x: toX, y: toY }, WORLD),
      now,
      onAsteroidAbsorbed: (asteroid) => this.applyEffect(createAsteroidExplosion(asteroid, 0.7)),
      onAsteroidRemoved: (asteroid) => this.removeAsteroid(asteroid),
      onBlackHoleRemoved: (projectile) => this.removeProjectile(projectile),
      onFuelBurst: (projectile) => {
        if (projectile.absorbedFuel > 0)
          this.addFuelBlobs(
            spawnFuelBlobs(projectile.position, projectile.velocity, projectile.absorbedFuel),
          );
        this.applyEffect(
          createExplosionBurst(
            projectile.position,
            projectile.velocity,
            Math.max(0.6, projectile.absorbedFuel * 0.12),
          ),
        );
      },
      planets: this.planets,
      projectileBodies: this.projectileBodies,
      projectiles: this.runtime.world.projectiles,
      timeScale: deltaSeconds * 60,
    });
    this.resolvePlayerAsteroidCombat(now, shieldActive);
  }

  private resolveProjectileCombat(): void {
    for (const event of resolveProjectileContactCombat(
      this.contacts.consumeProjectileAsteroids(),
      this.asteroidBodies,
    )) {
      if (event.type === 'projectileHitAsteroid') {
        this.removeProjectile(event.projectile);
      } else {
        this.destroyAsteroid(event.asteroid, true);
      }
    }
  }

  private resolvePlayerAsteroidCombat(now: number, shieldActive: boolean): void {
    const result = resolvePlayerCombat({
      asteroids: shieldActive
        ? this.contacts.consumeShieldAsteroids()
        : this.contacts.consumePlayerAsteroids(),
      fuel: this.ship.fuel,
      invulnerable: now < this.player.invulnerableUntil,
      now,
      playerAlive: this.player.visible,
      playerPosition: this.player.position,
      playerVelocity: this.player.velocity,
      shieldActive,
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

  private resolvePlanetCollisions(): void {
    for (const asteroid of [...this.runtime.world.asteroids]) {
      if (this.collidesWithPlanet(asteroid.position, ASTEROIDS[asteroid.tier].collisionRadius))
        this.destroyAsteroid(asteroid, false);
    }
    for (const projectile of [...this.runtime.world.projectiles]) {
      if (
        projectile.kind !== 'blackHole' &&
        projectile.kind !== 'inspectionProbe' &&
        this.collidesWithPlanet(projectile.position, 6)
      )
        this.removeProjectile(projectile);
    }
    if (this.player.visible && this.collidesWithPlanet(this.player.position, 18))
      this.killPlayer(this.time.now);
  }

  private resolveInspectionProbeHits(now: number): void {
    for (const projectile of [...this.runtime.world.projectiles]) {
      if (projectile.kind === 'inspectionProbe') {
        const planet = this.planets.find((candidate) => {
          const delta = wrappedDelta(projectile.position, candidate.position, WORLD);
          return Math.hypot(delta.x, delta.y) <= candidate.radius + 5;
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
      const delta = wrappedDelta(position, planet.position, WORLD);
      return Math.hypot(delta.x, delta.y) <= radius + planet.radius;
    });
  }

  private destroyAsteroid(asteroid: AsteroidEntity, split: boolean): void {
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
    this.player.visible = false;
    this.player.respawnAt = now + RESPAWN_DELAY_MS;
    for (const effect of createShipExplosion(this.player.position, this.player.velocity))
      this.applyEffect(effect);
    this.playerBody.setVisible(false);
    this.playerBody.setVelocity({ x: 0, y: 0 });
  }

  private updateRespawn(now: number): void {
    if (this.player.visible || now < this.player.respawnAt) return;
    this.playerBody.setPosition(this.mothership.position);
    this.playerBody.setRotation(Math.PI * 0.5);
    this.playerBody.setVelocity({ x: 0, y: 0 });
    this.playerBody.setVisible(true);
    this.player.visible = true;
    this.player.respawnAt = 0;
    this.player.invulnerableUntil = now + 2200;
    this.ship.resetFuel();
    this.mothership.startReveal(now);
    this.sceneRenderer.setPlayerDocked(true);
  }

  private getTractorActive(action: ReturnType<ActionReader['read']>): boolean {
    return isTractorActive(this.weaponPolicy, this.ship, {
      firePrimary: action.firePrimary,
      fireSecondary: action.fireSecondary,
      playerActive: this.player.visible,
      timeDilation: action.timeDilation,
    });
  }

  private chooseSafeSpawn(): Vector {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const candidate = {
        x: WORLD.width * 0.5 + Phaser.Math.Between(-700, 700),
        y: WORLD.height * 0.5 + Phaser.Math.Between(-700, 700),
      };
      if (!this.collidesWithPlanet(candidate, 220)) return candidate;
    }
    return { x: WORLD.width * 0.5, y: WORLD.height * 0.5 };
  }

  private updateMothership(now: number): void {
    const undocked = this.mothership.update(this.player.position, now, WORLD);
    this.sceneRenderer.setPlayerDocked(!undocked);
  }

  private getWorldPositioningInput(): Parameters<typeof rebaseWorldAroundPlayer>[0] {
    return {
      asteroidBodies: this.asteroidBodies,
      fuelBlobViews: this.fuelBlobViews,
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

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x152033, 0.9);
    for (let x = 0; x <= WORLD.width; x += 240) graphics.lineBetween(x, 0, x, WORLD.height);
    for (let y = 0; y <= WORLD.height; y += 240) graphics.lineBetween(0, y, WORLD.width, y);
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

  private removeParticle(particle: ParticleEntity): void {
    this.runtime.removeParticle(particle);
  }

  private disposeRenderEffects(): void {
    this.renderEffects.dispose();
  }
}

function createInitialAsteroids(): AsteroidEntity[] {
  const tiers: AsteroidTier[] = ['small', 'medium', 'big', 'mega'];
  const asteroids: AsteroidEntity[] = [];
  for (let index = 0; index < INITIAL_ASTEROIDS; index += 1) {
    const tier = tiers[Phaser.Math.Between(0, tiers.length - 1)];
    const angle = Math.random() * Math.PI * 2;
    const speed = ASTEROIDS[tier].speed * Phaser.Math.FloatBetween(0.35, 0.8);
    asteroids.push(
      createAsteroid(
        tier,
        {
          x: Phaser.Math.Between(200, WORLD.width - 200),
          y: Phaser.Math.Between(200, WORLD.height - 200),
        },
        { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      ),
    );
  }
  return asteroids;
}
