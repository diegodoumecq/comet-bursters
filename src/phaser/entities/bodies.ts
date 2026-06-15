import Phaser from 'phaser';

import { ASTEROID_COLLISION_CATEGORY } from '../combat/collisionCategories';
import { applyMatterBodySpec } from '../core/matterBodySpec';
import type { MatterImage, Vector, WorldSize } from '../core/types';
import { getToroidalOffsets, wrapCoordinate } from '../asteroids/toroidal';
import { ENTITY_DEFINITIONS, ENTITIES } from './config';
import { ENTITY_TEXTURE_KEYS } from './textures';
import type { GameEntity } from './types';

const ENTITY_SELF_GROUP_BASE = -200_000;

type ToroidalCopy = {
  active: boolean;
  body: MatterImage;
  direction: Vector;
  visual: Phaser.GameObjects.Image;
};

type Snapshot = {
  angularVelocity: number;
  position: Vector;
  velocity: Vector;
};

export class EntityBodies {
  private readonly attached = new Set<number>();
  private readonly bodies = new Map<number, MatterImage>();
  private readonly visuals = new Map<number, Phaser.GameObjects.Image>();
  private readonly toroidalCopies = new Map<number, ToroidalCopy[]>();
  private readonly snapshots = new Map<number, Snapshot>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(entity: GameEntity): MatterImage {
    return this.attach(entity);
  }

  attach(entity: GameEntity): MatterImage {
    const existing = this.bodies.get(entity.id);
    if (existing) {
      this.attached.add(entity.id);
      this.placeBody(
        existing,
        this.getVisual(entity),
        entity,
        entity.position,
        entity.velocity,
        entity.rotation,
        entity.angularVelocity,
        true,
      );
      this.syncCollisionFilter(entity);
      return existing;
    }

    const body = this.createBody(entity);
    const visual = this.createVisual(entity);
    this.bodies.set(entity.id, body);
    this.visuals.set(entity.id, visual);
    this.attached.add(entity.id);
    this.syncCollisionFilter(entity);
    return body;
  }

  get(entity: GameEntity): MatterImage {
    const body = this.bodies.get(entity.id);
    if (!body) throw new Error(`Missing entity body ${entity.id}`);
    return body;
  }

  remove(entity: GameEntity): void {
    this.destroy(entity);
  }

  detach(entity: GameEntity): void {
    const body = this.get(entity);
    entity.position = { x: body.x, y: body.y };
    entity.velocity = { x: body.body.velocity.x, y: body.body.velocity.y };
    entity.rotation = this.getBodyRotation(body);
    entity.angularVelocity = body.body.angularVelocity;
    for (const current of this.getAllVisuals(entity)) {
      current.body.setVisible(false);
      current.visual.setVisible(false);
      current.body.body.collisionFilter.mask = 0;
      current.body.setVelocity(0, 0);
      current.body.setAngularVelocity(0);
    }
    this.attached.delete(entity.id);
    this.snapshots.delete(entity.id);
  }

  destroy(entity: GameEntity): void {
    this.get(entity).destroy();
    this.getVisual(entity).destroy();
    this.bodies.delete(entity.id);
    this.visuals.delete(entity.id);
    this.attached.delete(entity.id);
    const copies = this.toroidalCopies.get(entity.id) ?? [];
    for (const copy of copies) {
      copy.body.destroy();
      copy.visual.destroy();
    }
    this.toroidalCopies.delete(entity.id);
    this.snapshots.delete(entity.id);
  }

  sync(entity: GameEntity): void {
    if (!this.attached.has(entity.id)) return;
    const body = this.get(entity);
    entity.position = { x: body.x, y: body.y };
    entity.velocity = { x: body.body.velocity.x, y: body.body.velocity.y };
    entity.rotation = this.getBodyRotation(body);
    entity.angularVelocity = body.body.angularVelocity;
    this.syncVisual(this.getVisual(entity), entity);
  }

  syncAll(entities: GameEntity[]): void {
    for (const entity of entities) this.sync(entity);
  }

  syncToroidalAll(entities: GameEntity[], world: WorldSize): void {
    const attachedEntities = entities.filter((entity) => this.attached.has(entity.id));
    for (const entity of attachedEntities) this.reconcileToroidal(entity, world);
    for (const entity of attachedEntities) this.prepareToroidalCopies(entity, world);
  }

  getBodyIds(entity: GameEntity): number[] {
    const bodyIds = [this.get(entity).body.id];
    const copies = this.toroidalCopies.get(entity.id) ?? [];
    for (const copy of copies) bodyIds.push(copy.body.body.id);
    return bodyIds;
  }

  syncCollisionFilter(entity: GameEntity): void {
    for (const body of this.getAllBodies(entity)) {
      body.body.collisionFilter.group = ENTITY_SELF_GROUP_BASE - entity.id;
    }
  }

  setVisible(entity: GameEntity, visible: boolean): void {
    for (const current of this.getAllVisuals(entity)) {
      current.body.setVisible(false);
      current.visual.setVisible(visible);
      current.body.body.collisionFilter.mask =
        visible && this.attached.has(entity.id) ? 0xffffffff : 0;
    }
  }

  private getVisual(entity: GameEntity): Phaser.GameObjects.Image {
    const visual = this.visuals.get(entity.id);
    if (!visual) throw new Error(`Missing entity visual ${entity.id}`);
    return visual;
  }

  private reconcileToroidal(entity: GameEntity, world: WorldSize): void {
    const primary = this.get(entity);
    const snapshot = this.snapshots.get(entity.id) ?? {
      angularVelocity: primary.body.angularVelocity,
      position: { x: entity.position.x, y: entity.position.y },
      velocity: { x: entity.velocity.x, y: entity.velocity.y },
    };
    const copies = this.toroidalCopies.get(entity.id) ?? [];
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
    entity.position = position;
    entity.velocity = velocity;
    entity.rotation = rotation;
    entity.angularVelocity = angularVelocity;
    this.placeBody(
      primary,
      this.getVisual(entity),
      entity,
      position,
      velocity,
      rotation,
      angularVelocity,
      true,
    );
  }

  private prepareToroidalCopies(entity: GameEntity, world: WorldSize): void {
    const copies = this.ensureToroidalCopies(entity);
    const activeOffsets = getToroidalOffsets(
      entity.position,
      ENTITIES[entity.kind].size * 0.5,
      world,
    );
    const velocity = entity.velocity;
    const primary = this.get(entity);
    const rotation = entity.rotation;
    const angularVelocity = entity.angularVelocity;
    this.placeBody(
      primary,
      this.getVisual(entity),
      entity,
      entity.position,
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
        x: entity.position.x + offset.x,
        y: entity.position.y + offset.y,
      };
      copy.active = active;
      this.placeBody(
        copy.body,
        copy.visual,
        entity,
        position,
        velocity,
        rotation,
        angularVelocity,
        active,
      );
    }
    this.syncCollisionFilter(entity);
    this.snapshots.set(entity.id, {
      angularVelocity,
      position: { x: entity.position.x, y: entity.position.y },
      velocity: { x: entity.velocity.x, y: entity.velocity.y },
    });
  }

  private ensureToroidalCopies(entity: GameEntity): ToroidalCopy[] {
    const existing = this.toroidalCopies.get(entity.id);
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
      body: this.createBody(entity),
      direction,
      visual: this.createVisual(entity),
    }));
    this.toroidalCopies.set(entity.id, copies);
    return copies;
  }

  private createBody(entity: GameEntity): MatterImage {
    const config = ENTITY_DEFINITIONS[entity.kind];
    const textureKey = ENTITY_TEXTURE_KEYS[entity.kind];
    const body = this.scene.matter.add.image(
      entity.position.x,
      entity.position.y,
      textureKey,
    ) as MatterImage;
    const size = ENTITIES[entity.kind].size;
    body.setDisplaySize(size, size);
    body.setRectangle(size, size);
    applyMatterBodySpec(body, config.body);
    body.body.collisionFilter.category = ASTEROID_COLLISION_CATEGORY;
    body.setVelocity(entity.velocity.x, entity.velocity.y);
    body.setRotation(entity.rotation);
    body.setAngularVelocity(entity.angularVelocity);
    body.setVisible(false);
    return body;
  }

  private createVisual(entity: GameEntity): Phaser.GameObjects.Image {
    const textureKey = ENTITY_TEXTURE_KEYS[entity.kind];
    const visual = this.scene.add.image(entity.position.x, entity.position.y, textureKey);
    const size = ENTITIES[entity.kind].size;
    visual.setDisplaySize(size, size);
    visual.setName(`entity-visual-${entity.id}`);
    this.syncVisual(visual, entity);
    return visual;
  }

  private getAllBodies(entity: GameEntity): MatterImage[] {
    const copies = this.toroidalCopies.get(entity.id) ?? [];
    return [this.get(entity), ...copies.map((copy) => copy.body)];
  }

  private getAllVisuals(
    entity: GameEntity,
  ): Array<{ body: MatterImage; visual: Phaser.GameObjects.Image }> {
    const copies = this.toroidalCopies.get(entity.id) ?? [];
    return [
      { body: this.get(entity), visual: this.getVisual(entity) },
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
    visual: Phaser.GameObjects.Image,
    entity: GameEntity,
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
    body.setVisible(false);
    body.body.collisionFilter.mask = active ? 0xffffffff : 0;
    visual.setPosition(position.x, position.y);
    visual.setRotation(rotation);
    visual.setVisible(active);
    this.syncVisual(visual, entity);
  }

  private syncVisual(visual: Phaser.GameObjects.Image, entity: GameEntity): void {
    visual.setPosition(entity.position.x, entity.position.y);
    visual.setRotation(entity.rotation);
    visual.setDisplaySize(ENTITIES[entity.kind].size, ENTITIES[entity.kind].size);
  }

  private getBodyRotation(body: MatterImage): number {
    return body.body.angle;
  }
}

function getWorldOffset(direction: Vector, world: WorldSize): Vector {
  return { x: direction.x * world.width, y: direction.y * world.height };
}
