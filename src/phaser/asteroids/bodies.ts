import Phaser from 'phaser';

import { ASTEROID_COLLISION_CATEGORY } from '../combat/collisionCategories';
import type { MatterImage, Vector, WorldSize } from '../core/types';
import { ASTEROIDS } from './logic';
import { ASTEROID_TEXTURES } from './textures';
import { getToroidalOffsets, wrapCoordinate } from './toroidal';
import type { AsteroidEntity } from './types';

const SPLIT_GROUP_MULTIPLIER = -1;
const ASTEROID_SELF_GROUP_BASE = -100_000;

type ToroidalCopy = {
  active: boolean;
  body: MatterImage;
  direction: Vector;
};

type Snapshot = {
  angularVelocity: number;
  position: Vector;
  velocity: Vector;
};

export class AsteroidBodies {
  private readonly bodies = new Map<number, MatterImage>();
  private readonly toroidalCopies = new Map<number, ToroidalCopy[]>();
  private readonly snapshots = new Map<number, Snapshot>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(asteroid: AsteroidEntity): MatterImage {
    const config = ASTEROIDS[asteroid.tier];
    const body = this.scene.matter.add.image(
      asteroid.position.x,
      asteroid.position.y,
      ASTEROID_TEXTURES[asteroid.tier][asteroid.visualVariant],
    ) as MatterImage;
    body.setCircle(config.collisionRadius);
    body.setMass(config.mass);
    body.setFrictionAir(0);
    body.setBounce(1);
    body.body.collisionFilter.category = ASTEROID_COLLISION_CATEGORY;
    body.setVelocity(asteroid.velocity.x, asteroid.velocity.y);
    this.bodies.set(asteroid.id, body);
    this.syncCollisionFilter(asteroid);
    return body;
  }

  get(asteroid: AsteroidEntity): MatterImage {
    const body = this.bodies.get(asteroid.id);
    if (!body) throw new Error(`Missing asteroid body ${asteroid.id}`);
    return body;
  }

  remove(asteroid: AsteroidEntity): void {
    this.get(asteroid).destroy();
    this.bodies.delete(asteroid.id);
    const copies = this.toroidalCopies.get(asteroid.id) ?? [];
    for (const copy of copies) copy.body.destroy();
    this.toroidalCopies.delete(asteroid.id);
    this.snapshots.delete(asteroid.id);
  }

  sync(asteroid: AsteroidEntity): void {
    const body = this.get(asteroid);
    asteroid.position = { x: body.x, y: body.y };
    asteroid.velocity = { x: body.body.velocity.x, y: body.body.velocity.y };
  }

  syncAll(asteroids: AsteroidEntity[]): void {
    for (const asteroid of asteroids) this.sync(asteroid);
  }

  syncToroidalAll(asteroids: AsteroidEntity[], world: WorldSize): void {
    for (const asteroid of asteroids) this.reconcileToroidal(asteroid, world);
    for (const asteroid of asteroids) this.prepareToroidalCopies(asteroid, world);
  }

  getBodyIds(asteroid: AsteroidEntity): number[] {
    const bodyIds = [this.get(asteroid).body.id];
    const copies = this.toroidalCopies.get(asteroid.id) ?? [];
    for (const copy of copies) bodyIds.push(copy.body.body.id);
    return bodyIds;
  }

  syncCollisionFilter(asteroid: AsteroidEntity): void {
    for (const body of this.getAllBodies(asteroid)) {
      body.body.collisionFilter.group = asteroid.splitGroupId
        ? asteroid.splitGroupId * SPLIT_GROUP_MULTIPLIER
        : ASTEROID_SELF_GROUP_BASE - asteroid.id;
    }
  }

  private reconcileToroidal(asteroid: AsteroidEntity, world: WorldSize): void {
    const primary = this.get(asteroid);
    const snapshot = this.snapshots.get(asteroid.id) ?? {
      angularVelocity: primary.body.angularVelocity,
      position: { x: asteroid.position.x, y: asteroid.position.y },
      velocity: { x: asteroid.velocity.x, y: asteroid.velocity.y },
    };
    const copies = this.toroidalCopies.get(asteroid.id) ?? [];
    let authority = {
      body: primary,
      offset: { x: 0, y: 0 },
      score: this.getChangeScore(primary, snapshot, { x: 0, y: 0 }),
    };
    for (const copy of copies) {
      if (copy.active) {
        const offset = getWorldOffset(copy.direction, world);
        const score = this.getChangeScore(copy.body, snapshot, offset);
        if (score > authority.score) {
          authority = { body: copy.body, offset, score };
        }
      }
    }

    const position = {
      x: wrapCoordinate(authority.body.x - authority.offset.x, world.width),
      y: wrapCoordinate(authority.body.y - authority.offset.y, world.height),
    };
    const velocity = {
      x: authority.body.body.velocity.x,
      y: authority.body.body.velocity.y,
    };
    const rotation = authority.body.rotation;
    const angularVelocity = authority.body.body.angularVelocity;
    asteroid.position = position;
    asteroid.velocity = velocity;
    this.placeBody(primary, position, velocity, rotation, angularVelocity, true);
  }

  private prepareToroidalCopies(asteroid: AsteroidEntity, world: WorldSize): void {
    const copies = this.ensureToroidalCopies(asteroid);
    const activeOffsets = getToroidalOffsets(
      asteroid.position,
      ASTEROIDS[asteroid.tier].radius,
      world,
    );
    const velocity = asteroid.velocity;
    const primary = this.get(asteroid);
    const rotation = primary.rotation;
    const angularVelocity = primary.body.angularVelocity;
    this.placeBody(primary, asteroid.position, velocity, rotation, angularVelocity, true);
    for (const copy of copies) {
      const offset = getWorldOffset(copy.direction, world);
      const active = activeOffsets.some(
        (activeOffset) => activeOffset.x === offset.x && activeOffset.y === offset.y,
      );
      const position = {
        x: asteroid.position.x + offset.x,
        y: asteroid.position.y + offset.y,
      };
      copy.active = active;
      this.placeBody(copy.body, position, velocity, rotation, angularVelocity, active);
    }
    this.syncCollisionFilter(asteroid);
    this.snapshots.set(asteroid.id, {
      angularVelocity,
      position: { x: asteroid.position.x, y: asteroid.position.y },
      velocity: { x: asteroid.velocity.x, y: asteroid.velocity.y },
    });
  }

  private ensureToroidalCopies(asteroid: AsteroidEntity): ToroidalCopy[] {
    const existing = this.toroidalCopies.get(asteroid.id);
    if (existing) return existing;

    const directions = [
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    const copies = directions.map((direction) => ({
      active: false,
      body: this.createBody(asteroid),
      direction,
    }));
    this.toroidalCopies.set(asteroid.id, copies);
    return copies;
  }

  private createBody(asteroid: AsteroidEntity): MatterImage {
    const config = ASTEROIDS[asteroid.tier];
    const body = this.scene.matter.add.image(
      asteroid.position.x,
      asteroid.position.y,
      ASTEROID_TEXTURES[asteroid.tier][asteroid.visualVariant],
    ) as MatterImage;
    body.setCircle(config.collisionRadius);
    body.setMass(config.mass);
    body.setFrictionAir(0);
    body.setBounce(1);
    body.body.collisionFilter.category = ASTEROID_COLLISION_CATEGORY;
    body.setVelocity(asteroid.velocity.x, asteroid.velocity.y);
    return body;
  }

  private getAllBodies(asteroid: AsteroidEntity): MatterImage[] {
    const copies = this.toroidalCopies.get(asteroid.id) ?? [];
    return [this.get(asteroid), ...copies.map((copy) => copy.body)];
  }

  private getChangeScore(body: MatterImage, snapshot: Snapshot, offset: Vector): number {
    const mappedX = body.x - offset.x;
    const mappedY = body.y - offset.y;
    const dx = mappedX - snapshot.position.x;
    const dy = mappedY - snapshot.position.y;
    const dvx = body.body.velocity.x - snapshot.velocity.x;
    const dvy = body.body.velocity.y - snapshot.velocity.y;
    const angularVelocityDelta = body.body.angularVelocity - snapshot.angularVelocity;
    return (
      dx * dx +
      dy * dy +
      (dvx * dvx + dvy * dvy) * 100 +
      angularVelocityDelta * angularVelocityDelta
    );
  }

  private placeBody(
    body: MatterImage,
    position: Vector,
    velocity: Vector,
    rotation: number,
    angularVelocity: number,
    active: boolean,
  ): void {
    body.setPosition(position.x, position.y);
    body.setRotation(rotation);
    body.setVelocity(velocity.x, velocity.y);
    body.setAngularVelocity(angularVelocity);
    body.setVisible(active);
    body.body.collisionFilter.mask = active ? 0xffffffff : 0;
  }
}

function getWorldOffset(direction: Vector, world: WorldSize): Vector {
  return { x: direction.x * world.width, y: direction.y * world.height };
}
