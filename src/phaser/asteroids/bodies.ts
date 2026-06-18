import Phaser from 'phaser';

import { ASTEROID_COLLISION_CATEGORY } from '../combat/collisionCategories';
import { applyMatterBodySpec } from '../core/matterBodySpec';
import type { MatterImage, Vector, WorldSize } from '../core/types';
import { ASTEROID_DEFINITIONS, ASTEROIDS } from './config';
import {
  getAsteroidTextureBlend,
  getAsteroidTextureDisplaySize,
  getAsteroidTextureFrameRef,
} from './textures';
import { getToroidalOffsets, wrapCoordinate } from './toroidal';
import type { AsteroidEntity } from './types';

const SPLIT_GROUP_MULTIPLIER = -1;
const ASTEROID_SELF_GROUP_BASE = -100_000;

type ToroidalCopy = {
  active: boolean;
  body: MatterImage;
  direction: Vector;
  visual: AsteroidVisual;
};

type AsteroidVisual = {
  current: Phaser.GameObjects.Image;
  next: Phaser.GameObjects.Image;
};

type Snapshot = {
  angularVelocity: number;
  position: Vector;
  velocity: Vector;
};

export class AsteroidBodies {
  private readonly attached = new Set<number>();
  private readonly bodies = new Map<number, MatterImage>();
  private readonly bodyScales = new WeakMap<MatterImage, number>();
  private readonly visuals = new Map<number, AsteroidVisual>();
  private readonly toroidalCopies = new Map<number, ToroidalCopy[]>();
  private readonly snapshots = new Map<number, Snapshot>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(asteroid: AsteroidEntity): MatterImage {
    return this.attach(asteroid);
  }

  attach(asteroid: AsteroidEntity): MatterImage {
    const existing = this.bodies.get(asteroid.id);
    if (existing) {
      this.attached.add(asteroid.id);
      this.placeBody(
        existing,
        this.getVisual(asteroid),
        asteroid,
        asteroid.position,
        asteroid.velocity,
        asteroid.rotation,
        asteroid.angularVelocity,
        true,
      );
      this.syncCollisionFilter(asteroid);
      return existing;
    }

    const body = this.createBody(asteroid);
    const visual = this.createVisual(asteroid);
    this.bodies.set(asteroid.id, body);
    this.visuals.set(asteroid.id, visual);
    this.attached.add(asteroid.id);
    this.syncCollisionFilter(asteroid);
    return body;
  }

  get(asteroid: AsteroidEntity): MatterImage {
    const body = this.bodies.get(asteroid.id);
    if (!body) throw new Error(`Missing asteroid body ${asteroid.id}`);
    return body;
  }

  private getVisual(asteroid: AsteroidEntity): AsteroidVisual {
    const visual = this.visuals.get(asteroid.id);
    if (!visual) throw new Error(`Missing asteroid visual ${asteroid.id}`);
    return visual;
  }

  remove(asteroid: AsteroidEntity): void {
    this.destroy(asteroid);
  }

  detach(asteroid: AsteroidEntity): void {
    const body = this.get(asteroid);
    asteroid.position = { x: body.x, y: body.y };
    asteroid.velocity = { x: body.body.velocity.x, y: body.body.velocity.y };
    asteroid.rotation = this.getBodyRotation(body);
    asteroid.angularVelocity = body.body.angularVelocity;
    for (const current of this.getAllVisuals(asteroid)) {
      current.body.setVisible(false);
      this.setVisualVisible(current.visual, false);
      current.body.body.collisionFilter.mask = 0;
      current.body.setVelocity(0, 0);
      current.body.setAngularVelocity(0);
    }
    this.attached.delete(asteroid.id);
    this.snapshots.delete(asteroid.id);
  }

  destroy(asteroid: AsteroidEntity): void {
    this.get(asteroid).destroy();
    this.destroyVisual(this.getVisual(asteroid));
    this.bodies.delete(asteroid.id);
    this.visuals.delete(asteroid.id);
    this.attached.delete(asteroid.id);
    const copies = this.toroidalCopies.get(asteroid.id) ?? [];
    for (const copy of copies) {
      copy.body.destroy();
      this.destroyVisual(copy.visual);
    }
    this.toroidalCopies.delete(asteroid.id);
    this.snapshots.delete(asteroid.id);
  }

  sync(asteroid: AsteroidEntity): void {
    if (!this.attached.has(asteroid.id)) return;
    const body = this.get(asteroid);
    asteroid.position = { x: body.x, y: body.y };
    asteroid.velocity = { x: body.body.velocity.x, y: body.body.velocity.y };
    asteroid.rotation = this.getBodyRotation(body);
    asteroid.angularVelocity = body.body.angularVelocity;
    this.applyVisualFrame(this.getVisual(asteroid), asteroid, asteroid.rotation);
  }

  syncAll(asteroids: AsteroidEntity[]): void {
    for (const asteroid of asteroids) this.sync(asteroid);
  }

  syncToroidalAll(asteroids: AsteroidEntity[], world: WorldSize): void {
    const attachedAsteroids = asteroids.filter((asteroid) => this.attached.has(asteroid.id));
    for (const asteroid of attachedAsteroids) this.reconcileToroidal(asteroid, world);
    for (const asteroid of attachedAsteroids) this.prepareToroidalCopies(asteroid, world);
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

  setVisible(asteroid: AsteroidEntity, visible: boolean): void {
    for (const current of this.getAllVisuals(asteroid)) {
      current.body.setVisible(false);
      this.setVisualVisible(current.visual, visible);
      current.body.body.collisionFilter.mask =
        visible && this.attached.has(asteroid.id) ? 0xffffffff : 0;
    }
  }

  setPosition(asteroid: AsteroidEntity, position: Vector): void {
    asteroid.position = { ...position };
    this.placeBody(
      this.get(asteroid),
      this.getVisual(asteroid),
      asteroid,
      asteroid.position,
      asteroid.velocity,
      asteroid.rotation,
      asteroid.angularVelocity,
      this.attached.has(asteroid.id),
    );
    this.snapshots.delete(asteroid.id);
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
    const rotation = this.getBodyRotation(authority.body);
    const angularVelocity = authority.body.body.angularVelocity;
    asteroid.position = position;
    asteroid.velocity = velocity;
    asteroid.rotation = rotation;
    asteroid.angularVelocity = angularVelocity;
    this.placeBody(
      primary,
      this.getVisual(asteroid),
      asteroid,
      position,
      velocity,
      rotation,
      angularVelocity,
      true,
    );
  }

  private prepareToroidalCopies(asteroid: AsteroidEntity, world: WorldSize): void {
    const copies = this.ensureToroidalCopies(asteroid);
    const activeOffsets = getToroidalOffsets(
      asteroid.position,
      ASTEROIDS[asteroid.tier].radius * getAsteroidSpawnScale(asteroid),
      world,
    );
    const velocity = asteroid.velocity;
    const primary = this.get(asteroid);
    const rotation = asteroid.rotation;
    const angularVelocity = asteroid.angularVelocity;
    this.placeBody(
      primary,
      this.getVisual(asteroid),
      asteroid,
      asteroid.position,
      velocity,
      rotation,
      angularVelocity,
      true,
    );
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
      this.placeBody(
        copy.body,
        copy.visual,
        asteroid,
        position,
        velocity,
        rotation,
        angularVelocity,
        active,
      );
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
      visual: this.createVisual(asteroid),
    }));
    this.toroidalCopies.set(asteroid.id, copies);
    return copies;
  }

  private createBody(asteroid: AsteroidEntity): MatterImage {
    const config = ASTEROID_DEFINITIONS[asteroid.tier];
    const texture = getAsteroidTextureFrameRef(
      asteroid.tier,
      asteroid.visualVariant,
      asteroid.rotation,
    );
    const body = this.scene.matter.add.image(
      asteroid.position.x,
      asteroid.position.y,
      texture.textureKey,
      texture.frameKey,
    ) as MatterImage;
    const displaySize = getAsteroidTextureDisplaySize(asteroid.tier);
    const spawnScale = getAsteroidSpawnScale(asteroid);
    body.setDisplaySize(displaySize * spawnScale, displaySize * spawnScale);
    body.setCircle(config.body.collisionRadius * spawnScale);
    this.bodyScales.set(body, spawnScale);
    applyMatterBodySpec(body, config.body);
    body.body.collisionFilter.category = ASTEROID_COLLISION_CATEGORY;
    body.setVelocity(asteroid.velocity.x, asteroid.velocity.y);
    body.setRotation(asteroid.rotation);
    body.setAngularVelocity(asteroid.angularVelocity);
    body.setVisible(false);
    return body;
  }

  private createVisual(asteroid: AsteroidEntity): AsteroidVisual {
    const texture = getAsteroidTextureFrameRef(
      asteroid.tier,
      asteroid.visualVariant,
      asteroid.rotation,
    );
    const current = this.scene.add.image(
      asteroid.position.x,
      asteroid.position.y,
      texture.textureKey,
      texture.frameKey,
    );
    const next = this.scene.add.image(
      asteroid.position.x,
      asteroid.position.y,
      texture.textureKey,
      texture.frameKey,
    );
    const visual = { current, next };
    const displaySize = getAsteroidTextureDisplaySize(asteroid.tier);
    const spawnScale = getAsteroidSpawnScale(asteroid);
    current.setDisplaySize(displaySize * spawnScale, displaySize * spawnScale);
    current.setName(`asteroid-visual-${asteroid.id}`);
    next.setDisplaySize(displaySize * spawnScale, displaySize * spawnScale);
    next.setName(`asteroid-visual-${asteroid.id}-blend`);
    this.applyVisualFrame(visual, asteroid, asteroid.rotation);
    return visual;
  }

  private getAllBodies(asteroid: AsteroidEntity): MatterImage[] {
    const copies = this.toroidalCopies.get(asteroid.id) ?? [];
    return [this.get(asteroid), ...copies.map((copy) => copy.body)];
  }

  private getAllVisuals(
    asteroid: AsteroidEntity,
  ): Array<{ body: MatterImage; visual: AsteroidVisual }> {
    const copies = this.toroidalCopies.get(asteroid.id) ?? [];
    return [
      { body: this.get(asteroid), visual: this.getVisual(asteroid) },
      ...copies.map((copy) => ({ body: copy.body, visual: copy.visual })),
    ];
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
    visual: AsteroidVisual,
    asteroid: AsteroidEntity,
    position: Vector,
    velocity: Vector,
    rotation: number,
    angularVelocity: number,
    active: boolean,
  ): void {
    body.setPosition(position.x, position.y);
    body.setRotation(rotation);
    this.applyBodyScale(body, asteroid);
    body.setVelocity(velocity.x, velocity.y);
    body.setAngularVelocity(angularVelocity);
    body.setVisible(false);
    body.body.collisionFilter.mask = active ? 0xffffffff : 0;
    visual.current.setPosition(position.x, position.y);
    visual.next.setPosition(position.x, position.y);
    this.applyVisualFrame(visual, asteroid, rotation);
    this.setVisualVisible(visual, active);
  }

  private applyVisualFrame(
    visual: AsteroidVisual,
    asteroid: AsteroidEntity,
    rotation: number,
  ): void {
    const textureBlend = getAsteroidTextureBlend(asteroid.tier, asteroid.visualVariant, rotation);
    if (
      visual.current.texture.key !== textureBlend.current.textureKey ||
      visual.current.frame.name !== textureBlend.current.frameKey
    )
      visual.current.setTexture(textureBlend.current.textureKey, textureBlend.current.frameKey);
    if (
      visual.next.texture.key !== textureBlend.next.textureKey ||
      visual.next.frame.name !== textureBlend.next.frameKey
    )
      visual.next.setTexture(textureBlend.next.textureKey, textureBlend.next.frameKey);
    const displaySize = getAsteroidTextureDisplaySize(asteroid.tier);
    const spawnScale = getAsteroidSpawnScale(asteroid);
    visual.current.setDisplaySize(displaySize * spawnScale, displaySize * spawnScale);
    visual.next.setDisplaySize(displaySize * spawnScale, displaySize * spawnScale);
    visual.current.setRotation(Phaser.Math.Angle.Wrap(textureBlend.current.frameAngle - rotation));
    visual.next.setRotation(Phaser.Math.Angle.Wrap(textureBlend.next.frameAngle - rotation));
    visual.current.setAlpha(1);
    visual.next.setAlpha(textureBlend.nextAlpha);
    this.setVisualVisible(visual, visual.current.visible);
  }

  private destroyVisual(visual: AsteroidVisual): void {
    visual.current.destroy();
    visual.next.destroy();
  }

  private setVisualVisible(visual: AsteroidVisual, visible: boolean): void {
    visual.current.setVisible(visible);
    visual.next.setVisible(visible && visual.next.alpha > 0.001);
  }

  private applyBodyScale(body: MatterImage, asteroid: AsteroidEntity): void {
    const spawnScale = getAsteroidSpawnScale(asteroid);
    const currentScale = this.bodyScales.get(body);
    if (currentScale === spawnScale) return;
    const config = ASTEROID_DEFINITIONS[asteroid.tier];
    body.setCircle(config.body.collisionRadius * spawnScale);
    applyMatterBodySpec(body, config.body);
    body.body.collisionFilter.category = ASTEROID_COLLISION_CATEGORY;
    this.bodyScales.set(body, spawnScale);
  }

  private getBodyRotation(body: MatterImage): number {
    return body.body.angle;
  }
}

function getWorldOffset(direction: Vector, world: WorldSize): Vector {
  return { x: direction.x * world.width, y: direction.y * world.height };
}

function getAsteroidSpawnScale(asteroid: AsteroidEntity): number {
  return Phaser.Math.Clamp(asteroid.spawnScale ?? 1, 0.08, 1);
}
