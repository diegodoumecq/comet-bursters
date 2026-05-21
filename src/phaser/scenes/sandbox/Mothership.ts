import Phaser from 'phaser';

import mothershipBackUrl from '@/assets/mothership-back.png';
import mothershipDoorUrl from '@/assets/mothership-door.png';
import mothershipFrontUrl from '@/assets/mothership-front.png';
import type { Vector, WorldSize } from '../../core/types';
import { nearestWrappedPosition, wrappedDelta } from '../../world/geometry';

export const MOTHERSHIP_WIDTH = 980;
export const MOTHERSHIP_HEIGHT = 277;
export const MOTHERSHIP_CARGO_BAY_OFFSET: Vector = { x: 100, y: 0 };

const DOOR_OPEN_DURATION_MS = 900;
export const MOTHERSHIP_DOOR_SLIDE_DISTANCE = MOTHERSHIP_WIDTH * 0.162;
const FRONT_TEXTURE_KEY = 'sandbox-mothership-front';
const DOOR_TEXTURE_KEY = 'sandbox-mothership-door';
const BACK_TEXTURE_KEY = 'sandbox-mothership-back';
const PLAYER_DOCKED_DISTANCE = 30;
const BODY_BACK_DEPTH = -4;
const BODY_FRONT_DEPTH = -3;
const DOOR_DEPTH = 4;

export function preloadMothershipTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FRONT_TEXTURE_KEY))
    scene.load.image(FRONT_TEXTURE_KEY, mothershipFrontUrl);
  if (!scene.textures.exists(DOOR_TEXTURE_KEY))
    scene.load.image(DOOR_TEXTURE_KEY, mothershipDoorUrl);
  if (!scene.textures.exists(BACK_TEXTURE_KEY))
    scene.load.image(BACK_TEXTURE_KEY, mothershipBackUrl);
}

export class Mothership {
  private readonly front: Phaser.GameObjects.Image;
  private readonly door: Phaser.GameObjects.Image;
  private readonly back: Phaser.GameObjects.Image;
  private doorOpenedAt: number | null = null;
  private undocked = false;

  constructor(
    scene: Phaser.Scene,
    readonly position: Vector,
  ) {
    this.back = createLayer(scene, position, BACK_TEXTURE_KEY, BODY_BACK_DEPTH);
    this.front = createLayer(scene, position, FRONT_TEXTURE_KEY, BODY_FRONT_DEPTH);
    this.door = createLayer(scene, position, DOOR_TEXTURE_KEY, DOOR_DEPTH);
  }

  startReveal(now: number): void {
    this.doorOpenedAt = now;
    this.undocked = false;
    this.sync(now);
  }

  closeDoor(now: number): void {
    this.doorOpenedAt = null;
    this.undocked = false;
    this.sync(now);
  }

  update(playerPosition: Vector, now: number, world: WorldSize): boolean {
    const playerDelta = wrappedDelta(this.getCargoBayPosition(), playerPosition, world);
    const movedFromBay = Math.hypot(playerDelta.x, playerDelta.y) > PLAYER_DOCKED_DISTANCE;
    if (!this.undocked && movedFromBay) this.undocked = true;
    this.sync(now);
    return this.undocked;
  }

  moveBy(shift: Vector): void {
    this.position.x += shift.x;
    this.position.y += shift.y;
  }

  keepNear(reference: Vector, world: WorldSize): void {
    const nearest = nearestWrappedPosition(reference, this.position, world);
    this.position.x = nearest.x;
    this.position.y = nearest.y;
  }

  sync(now: number): void {
    const progress = this.getDoorOpenProgress(now);
    this.front.setPosition(this.position.x, this.position.y);
    this.back.setPosition(this.position.x, this.position.y);
    this.door.setPosition(this.position.x + progress * MOTHERSHIP_DOOR_SLIDE_DISTANCE, this.position.y);
  }

  getCargoBayPosition(): Vector {
    return {
      x: this.position.x + MOTHERSHIP_CARGO_BAY_OFFSET.x,
      y: this.position.y + MOTHERSHIP_CARGO_BAY_OFFSET.y,
    };
  }

  private getDoorOpenProgress(now: number): number {
    if (this.doorOpenedAt === null) return 0;
    return Phaser.Math.Clamp((now - this.doorOpenedAt) / DOOR_OPEN_DURATION_MS, 0, 1);
  }
}

function createLayer(
  scene: Phaser.Scene,
  position: Vector,
  texture: string,
  depth: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(position.x, position.y, texture)
    .setDisplaySize(MOTHERSHIP_WIDTH, MOTHERSHIP_HEIGHT)
    .setDepth(depth);
}
