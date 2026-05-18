import type Phaser from 'phaser';

import type { AsteroidEntity } from '../asteroids/types';
import type { ProjectileEntity } from '../projectiles/types';
import type { AsteroidBodies } from '../asteroids/bodies';
import type { ProjectileBodies } from '../projectiles/bodies';

export class MatterContacts {
  private readonly playerAsteroids = new Set<AsteroidEntity>();
  private readonly shieldAsteroids = new Set<AsteroidEntity>();
  private readonly projectileAsteroids: Array<{ asteroid: AsteroidEntity; projectile: ProjectileEntity }> = [];
  private playerBody: MatterJS.BodyType | null = null;
  private shieldBody: MatterJS.BodyType | null = null;
  private readonly asteroidsByBodyId = new Map<number, AsteroidEntity>();
  private readonly asteroidBodyIds = new WeakMap<AsteroidEntity, number>();
  private readonly projectilesByBodyId = new Map<number, ProjectileEntity>();
  private readonly projectileBodyIds = new WeakMap<ProjectileEntity, number>();

  constructor(scene: Phaser.Scene) {
    scene.matter.world.on('collisionstart', (event: { pairs: Array<{ bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }> }) => {
      for (const pair of event.pairs) {
        this.capturePlayerAsteroid(pair.bodyA, pair.bodyB);
        this.capturePlayerAsteroid(pair.bodyB, pair.bodyA);
        this.captureProjectileAsteroid(pair.bodyA, pair.bodyB);
        this.captureProjectileAsteroid(pair.bodyB, pair.bodyA);
        this.captureShieldAsteroid(pair.bodyA, pair.bodyB);
        this.captureShieldAsteroid(pair.bodyB, pair.bodyA);
      }
    });
  }

  setPlayer(body: MatterJS.BodyType): void {
    this.playerBody = body;
  }

  setShield(body: MatterJS.BodyType): void {
    this.shieldBody = body;
  }

  addAsteroid(asteroid: AsteroidEntity, runtime: AsteroidBodies): void {
    const bodyId = runtime.get(asteroid).body.id;
    this.asteroidsByBodyId.set(bodyId, asteroid);
    this.asteroidBodyIds.set(asteroid, bodyId);
  }

  removeAsteroid(asteroid: AsteroidEntity): void {
    const bodyId = this.asteroidBodyIds.get(asteroid);
    if (bodyId !== undefined) {
      this.asteroidsByBodyId.delete(bodyId);
      this.asteroidBodyIds.delete(asteroid);
    }
    this.playerAsteroids.delete(asteroid);
    this.shieldAsteroids.delete(asteroid);
  }

  addProjectile(projectile: ProjectileEntity, runtime: ProjectileBodies): void {
    const bodyId = runtime.get(projectile).body.id;
    this.projectilesByBodyId.set(bodyId, projectile);
    this.projectileBodyIds.set(projectile, bodyId);
  }

  removeProjectile(projectile: ProjectileEntity): void {
    const bodyId = this.projectileBodyIds.get(projectile);
    if (bodyId !== undefined) {
      this.projectilesByBodyId.delete(bodyId);
      this.projectileBodyIds.delete(projectile);
    }
  }

  consumePlayerAsteroids(): AsteroidEntity[] {
    const contacts = [...this.playerAsteroids];
    this.playerAsteroids.clear();
    return contacts;
  }

  consumeProjectileAsteroids(): Array<{ asteroid: AsteroidEntity; projectile: ProjectileEntity }> {
    const contacts = [...this.projectileAsteroids];
    this.projectileAsteroids.length = 0;
    return contacts;
  }

  consumeShieldAsteroids(): AsteroidEntity[] {
    const contacts = [...this.shieldAsteroids];
    this.shieldAsteroids.clear();
    return contacts;
  }

  private capturePlayerAsteroid(left: MatterJS.BodyType, right: MatterJS.BodyType): void {
    if (this.playerBody && left.id === this.playerBody.id) {
      const asteroid = this.asteroidsByBodyId.get(right.id);
      if (asteroid) this.playerAsteroids.add(asteroid);
    }
  }

  private captureProjectileAsteroid(left: MatterJS.BodyType, right: MatterJS.BodyType): void {
    const projectile = this.projectilesByBodyId.get(left.id);
    const asteroid = this.asteroidsByBodyId.get(right.id);
    if (projectile && asteroid) this.projectileAsteroids.push({ asteroid, projectile });
  }

  private captureShieldAsteroid(left: MatterJS.BodyType, right: MatterJS.BodyType): void {
    if (this.shieldBody && left.id === this.shieldBody.id) {
      const asteroid = this.asteroidsByBodyId.get(right.id);
      if (asteroid) this.shieldAsteroids.add(asteroid);
    }
  }
}
