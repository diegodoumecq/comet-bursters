import Phaser from 'phaser';

import type { AsteroidEntity } from '../asteroids/types';
import type { AsteroidBodies } from '../asteroids/bodies';
import type { PlanetEntity } from '../planets/types';
import type { ProjectileEntity } from './types';
import type { ProjectileBodies } from './bodies';

const MATURE_AFTER_MS = 900;
const COLLAPSE_AFTER_MS = 3500;
const COLLAPSE_DURATION_MS = 700;

export function updateBlackHoles(
  projectiles: ProjectileEntity[],
  projectileBodies: ProjectileBodies,
  asteroids: AsteroidEntity[],
  asteroidBodies: AsteroidBodies,
  planets: PlanetEntity[],
  removeProjectile: (projectile: ProjectileEntity) => void,
  removeAsteroid: (asteroid: AsteroidEntity) => void,
  onAsteroidAbsorbed?: (asteroid: AsteroidEntity) => void,
  onFuelBurst?: (projectile: ProjectileEntity) => void,
): void {
  for (const projectile of projectiles) {
    if (projectile.kind === 'blackHole') {
      const age = projectile.ageMs;
      const mature = age >= MATURE_AFTER_MS;
      const radius = mature ? 42 : 14 + (age / MATURE_AFTER_MS) * 28;
      const shape = projectileBodies.get(projectile);
      shape.setRadius(radius);
      const collidesWithPlanet = planets.some((planet) =>
        Phaser.Math.Distance.Between(projectile.position.x, projectile.position.y, planet.position.x, planet.position.y) <= radius + planet.radius,
      );
      if (collidesWithPlanet) {
        removeProjectile(projectile);
      } else {
        if (age >= COLLAPSE_AFTER_MS && projectile.collapseStartedAt === null) {
          projectile.collapseStartedAt = age;
          projectile.velocity.x = 0;
          projectile.velocity.y = 0;
          shape.setVelocity(0, 0);
        }
        if (projectile.collapseStartedAt !== null) {
          const collapse = (age - projectile.collapseStartedAt) / COLLAPSE_DURATION_MS;
          shape.setRadius(Math.max(0, radius * (1 - collapse)));
          if (collapse >= 1) {
            onFuelBurst?.(projectile);
            removeProjectile(projectile);
          }
        } else if (mature) {
          for (const asteroid of [...asteroids]) {
            const body = asteroidBodies.get(asteroid);
            const distance = Phaser.Math.Distance.Between(projectile.position.x, projectile.position.y, asteroid.position.x, asteroid.position.y);
            if (distance <= radius + body.width * 0.5) {
              projectile.absorbedFuel += asteroid.tier === 'mega' ? 8 : asteroid.tier === 'big' ? 4 : asteroid.tier === 'medium' ? 2 : 1;
              onAsteroidAbsorbed?.(asteroid);
              removeAsteroid(asteroid);
            } else if (distance < radius * 6 && distance > 0) {
              body.applyForce(
                new Phaser.Math.Vector2(
                  ((projectile.position.x - asteroid.position.x) / distance) * 0.00028,
                  ((projectile.position.y - asteroid.position.y) / distance) * 0.00028,
                ),
              );
            }
          }
        }
      }
    }
  }
}
