import type { AsteroidBodies } from '../asteroids/bodies';
import type { AsteroidEntity } from '../asteroids/types';
import type { MatterContacts } from '../combat/matterContacts';
import type { FuelBodies } from '../fuel/bodies';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import type { ParticleViews } from '../particles/views';
import type { ProjectileBodies } from '../projectiles/bodies';
import type { ProjectileEntity } from '../projectiles/types';
import type { EntityBodies } from '../entities/bodies';
import type { GameEntity } from '../entities/types';
import { GameWorld } from './state';

export class GameWorldRuntime {
  readonly world: GameWorld;

  constructor(
    private readonly asteroidBodies: AsteroidBodies,
    private readonly projectileBodies: ProjectileBodies,
    private readonly fuelBodies: FuelBodies,
    private readonly particleViews: ParticleViews,
    private readonly contacts: MatterContacts,
    private readonly entityBodies?: EntityBodies,
    world = new GameWorld(),
  ) {
    this.world = world;
  }

  addAsteroids(asteroids: AsteroidEntity[]): void {
    this.world.addAsteroids(asteroids);
    for (const asteroid of asteroids) {
      this.asteroidBodies.add(asteroid);
      this.contacts.addAsteroid(asteroid, this.asteroidBodies);
    }
  }

  addProjectile(projectile: ProjectileEntity): void {
    this.world.projectiles.push(projectile);
    this.projectileBodies.add(projectile);
    this.contacts.addProjectile(projectile, this.projectileBodies);
  }

  addFuelBlobs(blobs: FuelBlobEntity[]): void {
    this.world.addFuelBlobs(blobs);
    for (const blob of blobs) {
      this.fuelBodies.add(blob);
      this.contacts.addFuelBlob(blob, this.fuelBodies);
    }
  }

  addParticles(particles: ParticleEntity[]): void {
    this.world.addParticles(particles);
    for (const particle of particles) this.particleViews.add(particle);
  }

  addEntities(entities: GameEntity[]): void {
    if (!this.entityBodies) throw new Error('Entity bodies are not configured');
    this.world.addEntities(entities);
    for (const entity of entities) {
      this.entityBodies.add(entity);
      this.contacts.addEntity(entity, this.entityBodies);
    }
  }

  removeAsteroid(asteroid: AsteroidEntity): void {
    this.contacts.removeAsteroid(asteroid);
    this.asteroidBodies.remove(asteroid);
    this.world.removeAsteroid(asteroid);
  }

  removeProjectile(projectile: ProjectileEntity): void {
    this.contacts.removeProjectile(projectile);
    this.projectileBodies.remove(projectile);
    this.world.removeProjectile(projectile);
  }

  removeFuelBlob(blob: FuelBlobEntity): void {
    this.contacts.removeFuelBlob(blob);
    this.fuelBodies.remove(blob);
    this.world.removeFuelBlob(blob);
  }

  removeParticle(particle: ParticleEntity): void {
    this.particleViews.remove(particle);
    this.world.removeParticle(particle);
  }

  removeEntity(entity: GameEntity): void {
    if (!this.entityBodies) throw new Error('Entity bodies are not configured');
    this.contacts.removeEntity(entity);
    this.entityBodies.remove(entity);
    this.world.removeEntity(entity);
  }

  syncFuelBlobs(): void {
    for (const blob of this.world.fuelBlobs) this.fuelBodies.sync(blob);
  }

  getFuelBodies(): FuelBodies {
    return this.fuelBodies;
  }

  syncParticles(): void {
    for (const particle of this.world.particles) this.particleViews.sync(particle);
  }

  getEntityBodies(): EntityBodies {
    if (!this.entityBodies) throw new Error('Entity bodies are not configured');
    return this.entityBodies;
  }
}
