import Phaser from 'phaser';

import {
  ALL_COLLISION_CATEGORIES,
  FUEL_BLOB_COLLISION_CATEGORY,
} from '../combat/collisionCategories';
import type { MatterArc, Vector, WorldSize } from '../core/types';
import { wrapPoint } from '../world/geometry';
import { applyFuelBlobMotion, syncFuelBlobFromBody, syncFuelBlobVelocityToBody } from './blobLogic';
import { FUEL_BLOB_MASS, FUEL_BLOB_RADIUS } from './rules';
import type { FuelBlobEntity } from './types';

type FuelMatterArc = MatterArc & {
  setBounce(value: number): FuelMatterArc;
  setFrictionAir(value: number): FuelMatterArc;
  setMass(value: number): FuelMatterArc;
};

export class FuelBodies {
  private readonly bodies = new Map<number, FuelMatterArc>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(blob: FuelBlobEntity): FuelMatterArc {
    const body = this.scene.add.circle(blob.position.x, blob.position.y, FUEL_BLOB_RADIUS);
    body.setVisible(false);
    this.scene.matter.add.gameObject(body, {
      circleRadius: FUEL_BLOB_RADIUS,
    });
    const matterBody = body as FuelMatterArc;
    matterBody.setMass(FUEL_BLOB_MASS);
    matterBody.setFrictionAir(0);
    matterBody.setBounce(0.92);
    matterBody.body.collisionFilter.category = FUEL_BLOB_COLLISION_CATEGORY;
    matterBody.body.collisionFilter.mask = ALL_COLLISION_CATEGORIES;
    matterBody.setVelocity(blob.velocity.x, blob.velocity.y);
    this.bodies.set(blob.id, matterBody);
    return matterBody;
  }

  get(blob: FuelBlobEntity): FuelMatterArc {
    const body = this.bodies.get(blob.id);
    if (!body) throw new Error(`Missing fuel blob body ${blob.id}`);
    return body;
  }

  getBodyId(blob: FuelBlobEntity): number {
    return this.get(blob).body.id;
  }

  remove(blob: FuelBlobEntity): void {
    this.get(blob).destroy();
    this.bodies.delete(blob.id);
  }

  sync(blob: FuelBlobEntity): void {
    syncFuelBlobFromBody(blob, this.get(blob));
  }

  setPosition(blob: FuelBlobEntity, position: Vector): void {
    this.get(blob).setPosition(position.x, position.y);
    blob.position = { ...position };
  }

  setVelocity(blob: FuelBlobEntity, velocity: Vector): void {
    this.get(blob).setVelocity(velocity.x, velocity.y);
    blob.velocity = { ...velocity };
  }

  updateBlob(input: {
    attractsToPlayer: boolean;
    blob: FuelBlobEntity;
    deltaSeconds: number;
    player: Vector;
    world: WorldSize;
    wrap?: boolean;
  }): void {
    const body = this.get(input.blob);
    syncFuelBlobFromBody(input.blob, body);
    applyFuelBlobMotion(input.blob, input.player, input.attractsToPlayer, input.deltaSeconds);
    syncFuelBlobVelocityToBody(input.blob, body);
    if (input.wrap ?? true) wrapPoint(body, input.world);
    syncFuelBlobFromBody(input.blob, body);
  }

  updateAll(input: {
    attractsToPlayer: boolean;
    blobs: FuelBlobEntity[];
    deltaSeconds: number;
    player: Vector;
    world: WorldSize;
    wrap?: boolean;
  }): void {
    for (const blob of input.blobs) {
      this.updateBlob({
        attractsToPlayer: input.attractsToPlayer,
        blob,
        deltaSeconds: input.deltaSeconds,
        player: input.player,
        world: input.world,
        wrap: input.wrap,
      });
    }
  }
}
