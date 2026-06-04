import type { AsteroidBodies } from '../asteroids/bodies';
import { updateAsteroidSplitCollisions } from '../asteroids/splitCollisions';
import type { AsteroidEntity } from '../asteroids/types';
import type { MatterContacts } from '../combat/matterContacts';
import type { Vector, WorldSize } from '../core/types';
import type { SpaceId, TransferableEntitySnapshot } from '../dimensions/types';
import type { FuelBodies } from '../fuel/bodies';
import type { FuelBlobEntity } from '../fuel/types';
import { updateParticles } from '../particles/logic';
import type { ParticleEntity } from '../particles/types';
import type { ParticleViews } from '../particles/views';
import type { PlayerBody } from '../player/body';
import type { PlayerState } from '../player/state';
import type { ProjectileBodies } from '../projectiles/bodies';
import { updateProjectiles } from '../projectiles/logic';
import type { ProjectileEntity } from '../projectiles/types';
import { GameWorld } from './state';

type RuntimeAttachments = {
  asteroidBodies: AsteroidBodies;
  contacts: MatterContacts;
  createPlayerBody?: (player: PlayerState) => PlayerBody;
  fuelBodies: FuelBodies;
  particleViews: ParticleViews;
  persistentPlayerBody?: boolean;
  projectileBodies: ProjectileBodies;
};

export type DetachedSpaceEntity =
  | { entity: AsteroidEntity; kind: 'asteroid' }
  | { entity: FuelBlobEntity; kind: 'fuelBlob' }
  | { entity: ParticleEntity; kind: 'particle' }
  | { entity: PlayerState; kind: 'player' }
  | { entity: ProjectileEntity; kind: 'projectile' };

export class SpaceWorldRuntime {
  readonly world: GameWorld;
  private playerBody: PlayerBody | null = null;
  private playerState: PlayerState | null = null;
  private readonly previousPositions = new Map<string, Vector>();

  constructor(
    readonly space: SpaceId,
    private readonly attachments: RuntimeAttachments,
    world = new GameWorld(),
  ) {
    this.world = world;
  }

  attachPlayer(player: PlayerState, body?: PlayerBody): void {
    const position = { ...player.position };
    const velocity = { ...player.velocity };
    const rotation = player.rotation;
    this.playerState = player;
    this.playerBody =
      body ?? this.playerBody ?? this.attachments.createPlayerBody?.(player) ?? null;
    if (!this.playerBody) {
      throw new Error(`Cannot attach player to ${this.space} without a scene-local body`);
    }
    player.membership = { space: this.space };
    this.playerBody.setPosition(position);
    this.playerBody.setVelocity(velocity);
    this.playerBody.setRotation(rotation);
    this.attachments.contacts.setPlayer(this.playerBody.body.body);
    this.attachments.contacts.setShield(this.playerBody.shieldSensor.body);
    this.playerBody.setVisible(true);
    this.playerBody.setCollisionEnabled(true);
    this.rememberPreviousPosition('player', player.position);
  }

  detachPlayer(): void {
    if (this.playerState) {
      this.playerState.membership = { space: this.space };
    }
    if (this.playerBody) {
      this.playerBody.setVisible(false);
      this.playerBody.setCollisionEnabled(false);
      this.playerBody.updateShieldSensor(false);
      if (!this.attachments.persistentPlayerBody) {
        this.playerBody.destroy();
        this.playerBody = null;
      }
    }
    this.playerState = null;
  }

  hasPlayer(): boolean {
    return this.playerState !== null;
  }

  addAsteroids(asteroids: AsteroidEntity[]): void {
    for (const asteroid of asteroids) this.addAsteroidToRuntime(asteroid);
  }

  removeAsteroid(asteroid: AsteroidEntity): void {
    this.destroyAsteroidInRuntime(asteroid);
  }

  addProjectile(projectile: ProjectileEntity): void {
    projectile.membership = { space: this.space };
    this.world.projectiles.push(projectile);
    this.attachments.projectileBodies.add(projectile);
    this.attachments.contacts.addProjectile(projectile, this.attachments.projectileBodies);
    this.rememberPreviousPosition(`projectile:${projectile.id}`, projectile.position);
  }

  removeProjectile(projectile: ProjectileEntity): void {
    this.attachments.contacts.removeProjectile(projectile);
    this.attachments.projectileBodies.remove(projectile);
    this.world.removeProjectile(projectile);
    this.previousPositions.delete(`projectile:${projectile.id}`);
  }

  addFuelBlobs(blobs: FuelBlobEntity[]): void {
    this.world.addFuelBlobs(blobs);
    for (const blob of blobs) {
      blob.membership = { space: this.space };
      this.attachments.fuelBodies.add(blob);
      this.attachments.contacts.addFuelBlob(blob, this.attachments.fuelBodies);
      this.rememberPreviousPosition(`fuelBlob:${blob.id}`, blob.position);
    }
  }

  removeFuelBlob(blob: FuelBlobEntity): void {
    this.attachments.contacts.removeFuelBlob(blob);
    this.attachments.fuelBodies.remove(blob);
    this.world.removeFuelBlob(blob);
    this.previousPositions.delete(`fuelBlob:${blob.id}`);
  }

  addParticles(particles: ParticleEntity[]): void {
    this.world.addParticles(particles);
    for (const particle of particles) {
      particle.membership = { space: this.space };
      this.attachments.particleViews.add(particle);
      this.rememberPreviousPosition(`particle:${particle.id}`, particle.position);
    }
  }

  removeParticle(particle: ParticleEntity): void {
    this.attachments.particleViews.remove(particle);
    this.world.removeParticle(particle);
    this.previousPositions.delete(`particle:${particle.id}`);
  }

  syncPreviousPositions(): void {
    for (const asteroid of this.world.asteroids) {
      this.rememberPreviousPosition(`asteroid:${asteroid.id}`, asteroid.position);
    }
    for (const projectile of this.world.projectiles) {
      this.rememberPreviousPosition(`projectile:${projectile.id}`, projectile.position);
    }
    for (const blob of this.world.fuelBlobs) {
      this.rememberPreviousPosition(`fuelBlob:${blob.id}`, blob.position);
    }
    for (const particle of this.world.particles) {
      this.rememberPreviousPosition(`particle:${particle.id}`, particle.position);
    }
    if (this.playerState) this.rememberPreviousPosition('player', this.playerState.position);
  }

  getTransferSnapshots(): TransferableEntitySnapshot[] {
    const snapshots: TransferableEntitySnapshot[] = [];
    for (const asteroid of this.world.asteroids) {
      snapshots.push({
        id: asteroid.id,
        kind: 'asteroid',
        membership: asteroid.membership ?? { space: this.space },
        position: asteroid.position,
        previousPosition: this.getPreviousPosition(`asteroid:${asteroid.id}`, asteroid.position),
      });
    }
    for (const projectile of this.world.projectiles) {
      snapshots.push({
        id: projectile.id,
        kind: 'projectile',
        membership: projectile.membership ?? { space: this.space },
        position: projectile.position,
        previousPosition: this.getPreviousPosition(
          `projectile:${projectile.id}`,
          projectile.position,
        ),
      });
    }
    for (const blob of this.world.fuelBlobs) {
      snapshots.push({
        id: blob.id,
        kind: 'fuelBlob',
        membership: blob.membership ?? { space: this.space },
        position: blob.position,
        previousPosition: this.getPreviousPosition(`fuelBlob:${blob.id}`, blob.position),
      });
    }
    for (const particle of this.world.particles) {
      snapshots.push({
        id: particle.id,
        kind: 'particle',
        membership: particle.membership ?? { space: this.space },
        position: particle.position,
        previousPosition: this.getPreviousPosition(`particle:${particle.id}`, particle.position),
      });
    }
    if (this.playerState) {
      this.syncAttachedPlayerToState();
      snapshots.push({
        id: 'player',
        kind: 'player',
        membership: this.playerState.membership,
        position: this.playerState.position,
        previousPosition: this.getPreviousPosition('player', this.playerState.position),
      });
    }
    return snapshots;
  }

  clearNonShipEntities(): void {
    for (const asteroid of [...this.world.asteroids]) this.removeAsteroid(asteroid);
    for (const projectile of [...this.world.projectiles]) this.removeProjectile(projectile);
    for (const blob of [...this.world.fuelBlobs]) this.removeFuelBlob(blob);
    for (const particle of [...this.world.particles]) this.removeParticle(particle);
  }

  getAsteroidBodies(): AsteroidBodies {
    return this.attachments.asteroidBodies;
  }

  getContacts(): MatterContacts {
    return this.attachments.contacts;
  }

  getFuelBodies(): FuelBodies {
    return this.attachments.fuelBodies;
  }

  getPlayerBody(): PlayerBody | null {
    return this.playerBody;
  }

  getPlayerState(): PlayerState | null {
    return this.playerState;
  }

  getProjectileBodies(): ProjectileBodies {
    return this.attachments.projectileBodies;
  }

  updateSceneEntities(input: {
    deltaMs: number;
    deltaSeconds: number;
    worldSize: WorldSize;
  }): void {
    this.syncAttachedPlayerToState();
    this.attachments.asteroidBodies.syncToroidalAll(this.world.asteroids, input.worldSize);
    this.attachments.contacts.syncAsteroids(this.world.asteroids, this.attachments.asteroidBodies);
    updateAsteroidSplitCollisions(this.world.asteroids, this.attachments.asteroidBodies);
    for (const projectile of updateProjectiles(
      this.world.projectiles,
      this.attachments.projectileBodies,
      input.deltaSeconds,
      input.worldSize,
    )) {
      this.removeProjectile(projectile);
    }
    const expiredParticles = updateParticles(this.world.particles, input.deltaMs);
    for (const particle of expiredParticles) this.removeParticle(particle);
    for (const particle of this.world.particles) this.attachments.particleViews.sync(particle);
  }

  syncAttachedPlayerFromState(): void {
    if (!this.playerBody || !this.playerState) return;
    this.playerBody.setPosition(this.playerState.position);
    this.playerBody.setVelocity(this.playerState.velocity);
    this.playerBody.setRotation(this.playerState.rotation);
  }

  syncAttachedPlayerToState(): void {
    if (!this.playerBody || !this.playerState) return;
    this.playerBody.syncState();
  }

  detachTransferEntity(snapshot: TransferableEntitySnapshot): DetachedSpaceEntity | null {
    if (snapshot.kind === 'asteroid') {
      const asteroid = this.world.asteroids.find((candidate) => candidate.id === snapshot.id);
      if (!asteroid) return null;
      this.attachments.asteroidBodies.sync(asteroid);
      this.detachAsteroidFromRuntimeForTransfer(asteroid);
      return { entity: asteroid, kind: 'asteroid' };
    }
    if (snapshot.kind === 'projectile') {
      const projectile = this.world.projectiles.find((candidate) => candidate.id === snapshot.id);
      if (!projectile) return null;
      this.removeProjectile(projectile);
      return { entity: projectile, kind: 'projectile' };
    }
    if (snapshot.kind === 'fuelBlob') {
      const blob = this.world.fuelBlobs.find((candidate) => candidate.id === snapshot.id);
      if (!blob) return null;
      this.removeFuelBlob(blob);
      return { entity: blob, kind: 'fuelBlob' };
    }
    if (snapshot.kind === 'particle') {
      const particle = this.world.particles.find((candidate) => candidate.id === snapshot.id);
      if (!particle) return null;
      this.removeParticle(particle);
      return { entity: particle, kind: 'particle' };
    }
    if (!this.playerState) return null;
    this.syncAttachedPlayerToState();
    const player = this.playerState;
    this.detachPlayer();
    return { entity: player, kind: 'player' };
  }

  attachTransferredEntity(detached: DetachedSpaceEntity): void {
    if (detached.kind === 'asteroid') {
      this.attachAsteroidToRuntimeForTransfer(detached.entity);
    } else if (detached.kind === 'projectile') {
      this.addProjectile(detached.entity);
    } else if (detached.kind === 'fuelBlob') {
      this.addFuelBlobs([detached.entity]);
    } else if (detached.kind === 'particle') {
      this.addParticles([detached.entity]);
    } else {
      this.attachPlayer(detached.entity);
    }
  }

  private addAsteroidToRuntime(asteroid: AsteroidEntity): void {
    this.world.addAsteroids([asteroid]);
    asteroid.membership = { space: this.space };
    this.attachments.asteroidBodies.attach(asteroid);
    this.attachments.contacts.addAsteroid(asteroid, this.attachments.asteroidBodies);
    this.rememberPreviousPosition(`asteroid:${asteroid.id}`, asteroid.position);
  }

  private attachAsteroidToRuntimeForTransfer(asteroid: AsteroidEntity): void {
    this.world.addAsteroids([asteroid]);
    asteroid.membership = { space: this.space };
    this.attachments.asteroidBodies.attach(asteroid);
    this.attachments.contacts.addAsteroid(asteroid, this.attachments.asteroidBodies);
    this.rememberPreviousPosition(`asteroid:${asteroid.id}`, asteroid.position);
  }

  private detachAsteroidFromRuntimeForTransfer(asteroid: AsteroidEntity): void {
    this.attachments.contacts.removeAsteroid(asteroid);
    this.attachments.asteroidBodies.detach(asteroid);
    this.world.removeAsteroid(asteroid);
    this.previousPositions.delete(`asteroid:${asteroid.id}`);
  }

  private destroyAsteroidInRuntime(asteroid: AsteroidEntity): void {
    this.attachments.contacts.removeAsteroid(asteroid);
    this.attachments.asteroidBodies.destroy(asteroid);
    this.world.removeAsteroid(asteroid);
    this.previousPositions.delete(`asteroid:${asteroid.id}`);
  }

  private rememberPreviousPosition(key: string, position: Vector): void {
    this.previousPositions.set(key, { x: position.x, y: position.y });
  }

  private getPreviousPosition(key: string, fallback: Vector): Vector {
    return this.previousPositions.get(key) ?? { x: fallback.x, y: fallback.y };
  }
}
