import type { AsteroidEntity } from '../asteroids/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import type { ProjectileEntity } from '../projectiles/types';

export class GameWorld {
  asteroids: AsteroidEntity[] = [];
  fuelBlobs: FuelBlobEntity[] = [];
  particles: ParticleEntity[] = [];
  projectiles: ProjectileEntity[] = [];

  addAsteroids(asteroids: AsteroidEntity[]): void {
    this.asteroids.push(...asteroids);
  }

  addFuelBlobs(blobs: FuelBlobEntity[]): void {
    this.fuelBlobs.push(...blobs);
  }

  addParticles(particles: ParticleEntity[]): void {
    this.particles.push(...particles);
  }

  removeProjectile(projectile: ProjectileEntity): void {
    const index = this.projectiles.indexOf(projectile);
    if (index !== -1) this.projectiles.splice(index, 1);
  }

  removeAsteroid(asteroid: AsteroidEntity): void {
    const index = this.asteroids.indexOf(asteroid);
    if (index !== -1) this.asteroids.splice(index, 1);
  }

  removeFuelBlob(blob: FuelBlobEntity): void {
    const index = this.fuelBlobs.indexOf(blob);
    if (index !== -1) this.fuelBlobs.splice(index, 1);
  }

  removeParticle(particle: ParticleEntity): void {
    const index = this.particles.indexOf(particle);
    if (index !== -1) this.particles.splice(index, 1);
  }
}
