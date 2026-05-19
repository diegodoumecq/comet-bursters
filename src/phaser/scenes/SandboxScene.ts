import Phaser from 'phaser';

import { AsteroidBodies } from '../asteroids/bodies';
import { ASTEROIDS, createAsteroid } from '../asteroids/logic';
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
import { nearestWrappedPosition, normalize, wrappedDelta } from '../world/geometry';
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
import { SandboxRenderer } from './sandbox/SandboxRenderer';

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
  private readonly player = new PlayerState();
  private readonly ship = mainGameState.ship;
  private readonly weaponPolicy: SceneWeaponPolicy = { allowedWeapons: SANDBOX_WEAPONS };
  private readonly discovery = new SandboxDiscovery();
  private planets: SandboxPlanetEntity[] = [];
  private asteroids: AsteroidEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private fuelBlobs: FuelBlobEntity[] = [];
  private particles: ParticleEntity[] = [];
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
    this.fuelBlobViews = new FuelBlobViews(this);
    this.particleViews = new ParticleViews(this);
    this.planetViews = new PlanetViews(this);
    this.contacts = new MatterContacts(this);
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
    this.resolveCombat(time, action.shield);
    this.updateRespawn(time);
    this.updateMothership(time);
    this.discovery.update(this.player.position, this.planets, WORLD);
  }

  protected renderState(action: ReturnType<ActionReader['read']>, time: number): void {
    this.sceneRenderer.render({
      asteroidCount: this.asteroids.length,
      now: time,
      player: this.player,
      projectileCount: this.projectiles.length,
      shieldActive: action.shield,
      ship: this.ship,
      timeDilation: action.timeDilation,
      tractorActive: this.getTractorActive(action),
      inspectionProbes: this.inspectionProbes,
      discovery: this.discovery,
      planets: this.planets,
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
      this.rebaseWorldAroundPlayer();
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
      this.asteroids,
      this.asteroidBodies,
      weaponResult.tractorActive,
    );
    this.playerBody.updateShieldSensor(action.shield && this.player.visible && this.ship.fuel > 0);
  }

  private updateWorld(deltaMs: number, deltaSeconds: number): void {
    for (const asteroid of this.asteroids) {
      applyPlanetGravity(asteroid.velocity, asteroid.position, this.planets, WORLD, deltaSeconds);
      this.asteroidBodies.get(asteroid).setVelocity(asteroid.velocity.x, asteroid.velocity.y);
    }
    this.asteroidBodies.syncAll(this.asteroids);
    for (const projectile of this.projectiles) {
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
      this.projectiles,
      this.projectileBodies,
      deltaSeconds,
      WORLD,
      false,
    ))
      this.removeProjectile(projectile);
    updatePlanetFuel(this.planets, this.time.now);
    for (const blob of this.fuelBlobs) {
      applyPlanetGravity(blob.velocity, blob.position, this.planets, WORLD, deltaSeconds);
    }
    const fuel = updateFuelBlobs(
      this.fuelBlobs,
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
    for (const blob of this.fuelBlobs) this.fuelBlobViews.sync(blob);
    for (const blob of fuel.collected) this.removeFuelBlob(blob);
    for (const blob of absorbFuelIntoPlanets(this.fuelBlobs, this.planets, WORLD))
      this.removeFuelBlob(blob);
    for (const particle of updateParticles(this.particles, deltaMs)) this.removeParticle(particle);
    for (const particle of this.particles) this.particleViews.sync(particle);
    this.keepMovingEntitiesNearPlayer();
  }

  private resolveCombat(now: number, shieldActive: boolean): void {
    this.resolveProjectileCombat();
    this.resolveInspectionProbeHits(now);
    this.resolvePlanetCollisions();
    updateBlackHoles(
      this.projectiles,
      this.projectileBodies,
      this.asteroids,
      this.asteroidBodies,
      this.planets,
      (projectile) => this.removeProjectile(projectile),
      (asteroid) => this.removeAsteroid(asteroid),
      (asteroid) => this.applyEffect(createAsteroidExplosion(asteroid, 0.7)),
      (projectile) => {
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
    );
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
    for (const asteroid of [...this.asteroids]) {
      if (this.collidesWithPlanet(asteroid.position, ASTEROIDS[asteroid.tier].collisionRadius))
        this.destroyAsteroid(asteroid, false);
    }
    for (const projectile of [...this.projectiles]) {
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
    for (const projectile of [...this.projectiles]) {
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

  private rebaseWorldAroundPlayer(): void {
    const shift = {
      x:
        this.player.position.x < 0
          ? WORLD.width
          : this.player.position.x > WORLD.width
            ? -WORLD.width
            : 0,
      y:
        this.player.position.y < 0
          ? WORLD.height
          : this.player.position.y > WORLD.height
            ? -WORLD.height
            : 0,
    };
    if (shift.x === 0 && shift.y === 0) return;

    this.shiftPlayer(shift);
    for (const planet of this.planets) {
      planet.position.x += shift.x;
      planet.position.y += shift.y;
      this.planetViews.sync(planet);
    }
    for (const asteroid of this.asteroids) {
      asteroid.position.x += shift.x;
      asteroid.position.y += shift.y;
      this.asteroidBodies.get(asteroid).setPosition(asteroid.position.x, asteroid.position.y);
    }
    for (const projectile of this.projectiles) {
      projectile.position.x += shift.x;
      projectile.position.y += shift.y;
      this.projectileBodies.setPosition(projectile, projectile.position);
    }
    for (const blob of this.fuelBlobs) {
      blob.position.x += shift.x;
      blob.position.y += shift.y;
      this.fuelBlobViews.sync(blob);
    }
    for (const particle of this.particles) {
      particle.position.x += shift.x;
      particle.position.y += shift.y;
      this.particleViews.sync(particle);
    }
    this.mothership.moveBy(shift);
    this.mothership.sync(this.time.now);
  }

  private keepMovingEntitiesNearPlayer(): void {
    for (const planet of this.planets) {
      planet.position = nearestWrappedPosition(this.player.position, planet.position, WORLD);
      this.planetViews.sync(planet);
    }
    for (const asteroid of this.asteroids) {
      const position = nearestWrappedPosition(this.player.position, asteroid.position, WORLD);
      asteroid.position = position;
      this.asteroidBodies.get(asteroid).setPosition(position.x, position.y);
    }
    for (const projectile of this.projectiles) {
      const position = nearestWrappedPosition(this.player.position, projectile.position, WORLD);
      this.projectileBodies.setPosition(projectile, position);
    }
    for (const blob of this.fuelBlobs) {
      blob.position = nearestWrappedPosition(this.player.position, blob.position, WORLD);
      this.fuelBlobViews.sync(blob);
    }
    for (const particle of this.particles) {
      particle.position = nearestWrappedPosition(this.player.position, particle.position, WORLD);
      this.particleViews.sync(particle);
    }
    this.mothership.keepNear(this.player.position, WORLD);
    this.mothership.sync(this.time.now);
  }

  private shiftPlayer(shift: Vector): void {
    this.playerBody.setPosition({
      x: this.player.position.x + shift.x,
      y: this.player.position.y + shift.y,
    });
    this.playerBody.shieldSensor.setPosition(this.player.position.x, this.player.position.y);
  }

  private updateMothership(now: number): void {
    const undocked = this.mothership.update(this.player.position, now, WORLD);
    this.sceneRenderer.setPlayerDocked(!undocked);
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
    this.asteroids.push(...asteroids);
    for (const asteroid of asteroids) {
      this.asteroidBodies.add(asteroid);
      this.contacts.addAsteroid(asteroid, this.asteroidBodies);
    }
  }

  private addProjectile(projectile: ProjectileEntity): void {
    this.projectiles.push(projectile);
    this.projectileBodies.add(projectile);
    this.contacts.addProjectile(projectile, this.projectileBodies);
  }

  private addFuelBlobs(blobs: FuelBlobEntity[]): void {
    this.fuelBlobs.push(...blobs);
    for (const blob of blobs) this.fuelBlobViews.add(blob);
  }

  private addParticles(particles: ParticleEntity[]): void {
    this.particles.push(...particles);
    for (const particle of particles) this.particleViews.add(particle);
  }

  private removeAsteroid(asteroid: AsteroidEntity): void {
    this.contacts.removeAsteroid(asteroid);
    this.asteroidBodies.remove(asteroid);
    const index = this.asteroids.indexOf(asteroid);
    if (index !== -1) this.asteroids.splice(index, 1);
  }

  private removeProjectile(projectile: ProjectileEntity): void {
    this.contacts.removeProjectile(projectile);
    this.projectileBodies.remove(projectile);
    const index = this.projectiles.indexOf(projectile);
    if (index !== -1) this.projectiles.splice(index, 1);
  }

  private removeFuelBlob(blob: FuelBlobEntity): void {
    this.fuelBlobViews.remove(blob);
    const index = this.fuelBlobs.indexOf(blob);
    if (index !== -1) this.fuelBlobs.splice(index, 1);
  }

  private removeParticle(particle: ParticleEntity): void {
    this.particleViews.remove(particle);
    const index = this.particles.indexOf(particle);
    if (index !== -1) this.particles.splice(index, 1);
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
