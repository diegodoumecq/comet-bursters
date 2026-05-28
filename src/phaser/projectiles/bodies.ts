import Phaser from 'phaser';

import type { MatterArc, Vector } from '../core/types';
import { createProjectileShape } from '../weapons/rendering';
import type { ProjectileEntity } from './types';

export class ProjectileBodies {
  private readonly shapes = new Map<number, MatterArc>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(projectile: ProjectileEntity): MatterArc {
    const shape = createProjectileShape(
      this.scene,
      projectile.position,
      projectile.kind,
      projectile.angle,
    );
    shape.setVelocity(projectile.velocity.x, projectile.velocity.y);
    this.shapes.set(projectile.id, shape);
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
  }

  sync(projectile: ProjectileEntity): void {
    const shape = this.get(projectile);
    projectile.position = { x: shape.x, y: shape.y };
    projectile.velocity = { x: shape.body.velocity.x, y: shape.body.velocity.y };
  }

  setPosition(projectile: ProjectileEntity, position: Vector): void {
    this.get(projectile).setPosition(position.x, position.y);
    projectile.position = position;
  }

  setVisible(projectile: ProjectileEntity, visible: boolean): void {
    this.get(projectile).setVisible(visible);
  }
}
