import Phaser from 'phaser';

import type { AsteroidEntity, PlanetEntity, ProjectileEntity } from '../model';

const MATURE_AFTER_MS = 900;
const COLLAPSE_AFTER_MS = 3500;
const COLLAPSE_DURATION_MS = 700;

export function updateBlackHoles(
  projectiles: ProjectileEntity[],
  asteroids: AsteroidEntity[],
  planets: PlanetEntity[],
  now: number,
  removeProjectile: (projectile: ProjectileEntity) => void,
  removeAsteroid: (asteroid: AsteroidEntity) => void,
): void {
  for (const projectile of projectiles) {
    if (projectile.kind !== 'blackHole') continue;
    const age = now - projectile.createdAt;
    const mature = age >= MATURE_AFTER_MS;
    const radius = mature ? 42 : 14 + (age / MATURE_AFTER_MS) * 28;
    projectile.shape.setRadius(radius);
    if (planets.some((planet) => Phaser.Math.Distance.Between(projectile.shape.x, projectile.shape.y, planet.body.x, planet.body.y) <= radius + planet.radius)) {
      removeProjectile(projectile);
      continue;
    }
    if (age >= COLLAPSE_AFTER_MS && projectile.collapseStartedAt === null) {
      projectile.collapseStartedAt = now;
      projectile.velocity.x = 0;
      projectile.velocity.y = 0;
    }
    if (projectile.collapseStartedAt !== null) {
      const collapse = (now - projectile.collapseStartedAt) / COLLAPSE_DURATION_MS;
      projectile.shape.setRadius(Math.max(0, radius * (1 - collapse)));
      if (collapse >= 1) removeProjectile(projectile);
      continue;
    }
    if (mature) {
      for (const asteroid of [...asteroids]) {
        const distance = Phaser.Math.Distance.Between(projectile.shape.x, projectile.shape.y, asteroid.body.x, asteroid.body.y);
        if (distance <= radius + asteroid.body.width * 0.5) {
          projectile.absorbedFuel += asteroid.tier === 'big' ? 4 : asteroid.tier === 'medium' ? 2 : 1;
          removeAsteroid(asteroid);
        } else if (distance < radius * 6 && distance > 0) {
          asteroid.body.applyForce(
            new Phaser.Math.Vector2(
              ((projectile.shape.x - asteroid.body.x) / distance) * 0.00028,
              ((projectile.shape.y - asteroid.body.y) / distance) * 0.00028,
            ),
          );
        }
      }
    }
  }
}
