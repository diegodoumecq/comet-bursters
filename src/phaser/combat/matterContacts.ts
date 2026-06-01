import type Phaser from 'phaser';

import type { AsteroidBodies } from '../asteroids/bodies';
import type { AsteroidEntity } from '../asteroids/types';
import type { Vector } from '../core/types';
import type { ProjectileBodies } from '../projectiles/bodies';
import type { ProjectileEntity } from '../projectiles/types';

export type PlayerAsteroidContact = {
  asteroid: AsteroidEntity;
  asteroidVelocityBefore: Vector;
};

export class MatterContacts {
  private readonly playerAsteroids: PlayerAsteroidContact[] = [];
  private readonly shieldAsteroids = new Set<AsteroidEntity>();
  private readonly projectileAsteroids: Array<{
    asteroid: AsteroidEntity;
    projectile: ProjectileEntity;
  }> = [];
  private playerBody: MatterJS.BodyType | null = null;
  private shieldBody: MatterJS.BodyType | null = null;
  private readonly asteroidsByBodyId = new Map<number, AsteroidEntity>();
  private readonly asteroidBodyIds = new WeakMap<AsteroidEntity, Set<number>>();
  private readonly asteroidVelocitiesBeforeStep = new Map<number, Vector>();
  private readonly projectilesByBodyId = new Map<number, ProjectileEntity>();
  private readonly projectileBodyIds = new WeakMap<ProjectileEntity, number>();

  constructor(scene: Phaser.Scene) {
    scene.matter.world.on('beforeupdate', () => {
      this.asteroidVelocitiesBeforeStep.clear();
      for (const [bodyId, asteroid] of this.asteroidsByBodyId) {
        this.asteroidVelocitiesBeforeStep.set(bodyId, {
          x: asteroid.velocity.x,
          y: asteroid.velocity.y,
        });
      }
    });
    scene.matter.world.on(
      'collisionstart',
      (event: { pairs: Array<{ bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }> }) => {
        for (const pair of event.pairs) {
          this.capturePlayerAsteroid(pair.bodyA, pair.bodyB);
          this.capturePlayerAsteroid(pair.bodyB, pair.bodyA);
          this.captureProjectileAsteroid(pair.bodyA, pair.bodyB);
          this.captureProjectileAsteroid(pair.bodyB, pair.bodyA);
          this.captureShieldAsteroid(pair.bodyA, pair.bodyB);
          this.captureShieldAsteroid(pair.bodyB, pair.bodyA);
        }
      },
    );
  }

  setPlayer(body: MatterJS.BodyType): void {
    this.playerBody = body;
  }

  setShield(body: MatterJS.BodyType): void {
    this.shieldBody = body;
  }

  addAsteroid(asteroid: AsteroidEntity, runtime: AsteroidBodies): void {
    this.syncAsteroid(asteroid, runtime);
  }

  syncAsteroid(asteroid: AsteroidEntity, runtime: AsteroidBodies): void {
    const previousBodyIds = this.asteroidBodyIds.get(asteroid) ?? new Set<number>();
    const nextBodyIds = new Set(runtime.getBodyIds(asteroid));
    for (const bodyId of previousBodyIds) {
      if (!nextBodyIds.has(bodyId)) this.asteroidsByBodyId.delete(bodyId);
    }
    for (const bodyId of nextBodyIds) this.asteroidsByBodyId.set(bodyId, asteroid);
    this.asteroidBodyIds.set(asteroid, nextBodyIds);
  }

  syncAsteroids(asteroids: AsteroidEntity[], runtime: AsteroidBodies): void {
    for (const asteroid of asteroids) this.syncAsteroid(asteroid, runtime);
  }

  removeAsteroid(asteroid: AsteroidEntity): void {
    const bodyIds = this.asteroidBodyIds.get(asteroid);
    if (bodyIds) {
      for (const bodyId of bodyIds) this.asteroidsByBodyId.delete(bodyId);
      this.asteroidBodyIds.delete(asteroid);
    }
    this.removeQueuedPlayerAsteroidContacts((contact) => contact.asteroid === asteroid);
    this.shieldAsteroids.delete(asteroid);
    this.removeQueuedProjectileAsteroidContacts((contact) => contact.asteroid === asteroid);
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
    this.removeQueuedProjectileAsteroidContacts((contact) => contact.projectile === projectile);
  }

  consumePlayerAsteroids(): AsteroidEntity[] {
    const contacts = this.consumePlayerAsteroidContacts().map((contact) => contact.asteroid);
    return contacts;
  }

  consumePlayerAsteroidContacts(): PlayerAsteroidContact[] {
    const contacts = [...this.playerAsteroids];
    this.playerAsteroids.length = 0;
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
      if (asteroid && !this.hasPlayerAsteroidContact(asteroid)) {
        this.playerAsteroids.push({
          asteroid,
          asteroidVelocityBefore: this.getAsteroidVelocityBeforeStep(right.id, asteroid),
        });
      }
    }
  }

  private getAsteroidVelocityBeforeStep(bodyId: number, asteroid: AsteroidEntity): Vector {
    const velocity = this.asteroidVelocitiesBeforeStep.get(bodyId) ?? asteroid.velocity;
    return { x: velocity.x, y: velocity.y };
  }

  private captureProjectileAsteroid(left: MatterJS.BodyType, right: MatterJS.BodyType): void {
    const projectile = this.projectilesByBodyId.get(left.id);
    const asteroid = this.asteroidsByBodyId.get(right.id);
    if (projectile && asteroid && !this.hasProjectileAsteroidContact(projectile, asteroid))
      this.projectileAsteroids.push({ asteroid, projectile });
  }

  private captureShieldAsteroid(left: MatterJS.BodyType, right: MatterJS.BodyType): void {
    if (this.shieldBody && left.id === this.shieldBody.id) {
      const asteroid = this.asteroidsByBodyId.get(right.id);
      if (asteroid) this.shieldAsteroids.add(asteroid);
    }
  }

  private removeQueuedProjectileAsteroidContacts(
    shouldRemove: (contact: { asteroid: AsteroidEntity; projectile: ProjectileEntity }) => boolean,
  ): void {
    for (let index = this.projectileAsteroids.length - 1; index >= 0; index -= 1) {
      if (shouldRemove(this.projectileAsteroids[index])) {
        this.projectileAsteroids.splice(index, 1);
      }
    }
  }

  private removeQueuedPlayerAsteroidContacts(
    shouldRemove: (contact: PlayerAsteroidContact) => boolean,
  ): void {
    for (let index = this.playerAsteroids.length - 1; index >= 0; index -= 1) {
      if (shouldRemove(this.playerAsteroids[index])) {
        this.playerAsteroids.splice(index, 1);
      }
    }
  }

  private hasProjectileAsteroidContact(
    projectile: ProjectileEntity,
    asteroid: AsteroidEntity,
  ): boolean {
    return this.projectileAsteroids.some(
      (contact) => contact.projectile === projectile && contact.asteroid === asteroid,
    );
  }

  private hasPlayerAsteroidContact(asteroid: AsteroidEntity): boolean {
    return this.playerAsteroids.some((contact) => contact.asteroid === asteroid);
  }
}
