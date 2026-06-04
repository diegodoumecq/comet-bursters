import Phaser from 'phaser';

import { ALL_COLLISION_CATEGORIES } from '../combat/collisionCategories';
import type { MatterArc, Vector } from '../core/types';
import type { ProjectileEntity } from './types';
import { createProjectileShape, ProjectileVisuals } from './visuals';

export class ProjectileBodies {
  private readonly shapes = new Map<number, MatterArc>();
  private readonly visuals = new ProjectileVisuals((projectile) => this.get(projectile));

  constructor(private readonly scene: Phaser.Scene) {}

  add(projectile: ProjectileEntity): MatterArc {
    const shape = createProjectileShape(this.scene, projectile);
    shape.setVelocity(projectile.velocity.x, projectile.velocity.y);
    this.shapes.set(projectile.id, shape);
    this.visuals.syncWorld(projectile);
    return shape;
  }

  get(projectile: ProjectileEntity): MatterArc {
    const shape = this.shapes.get(projectile.id);
    if (!shape) throw new Error(`Missing projectile shape ${projectile.id}`);
    return shape;
  }

  remove(projectile: ProjectileEntity): void {
    this.get(projectile).destroy();
    this.shapes.delete(projectile.id);
    this.visuals.forget(projectile);
  }

  sync(projectile: ProjectileEntity): void {
    const shape = this.get(projectile);
    projectile.position = { x: shape.x, y: shape.y };
    projectile.velocity = { x: shape.body.velocity.x, y: shape.body.velocity.y };
    projectile.angle =
      Math.hypot(projectile.velocity.x, projectile.velocity.y) > 0
        ? Math.atan2(projectile.velocity.y, projectile.velocity.x)
        : projectile.angle;
    this.visuals.syncWorld(projectile);
  }

  syncVisualsRelativeToCamera(input: {
    camera: Phaser.Cameras.Scene2D.Camera;
    cameraVelocity?: Vector;
    projectiles: ProjectileEntity[];
    teleportThreshold: number;
  }): void {
    this.visuals.syncCameraRelative(input);
  }

  setPosition(projectile: ProjectileEntity, position: Vector): void {
    this.get(projectile).setPosition(position.x, position.y);
    projectile.position = position;
  }

  setVelocity(projectile: ProjectileEntity, velocity: Vector): void {
    const shape = this.get(projectile);
    shape.setVelocity(velocity.x, velocity.y);
    projectile.velocity = velocity;
    projectile.angle =
      Math.hypot(velocity.x, velocity.y) > 0 ? Math.atan2(velocity.y, velocity.x) : projectile.angle;
    this.visuals.syncWorld(projectile);
  }

  setCollisionEnabled(projectile: ProjectileEntity, enabled: boolean): void {
    this.get(projectile).body.collisionFilter.mask = enabled ? ALL_COLLISION_CATEGORIES : 0;
  }

  setVisible(projectile: ProjectileEntity, visible: boolean): void {
    this.get(projectile).setVisible(visible);
  }
}
