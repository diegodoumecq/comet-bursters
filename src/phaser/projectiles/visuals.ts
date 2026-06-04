import type Phaser from 'phaser';

import type { MatterArc, Vector } from '../core/types';
import type { ProjectileKind } from '../weapons/types';
import type { ProjectileEntity } from './types';

type ShapeProvider = (projectile: ProjectileEntity) => MatterArc;
type BodyRenderedProjectileKind = Exclude<ProjectileKind, 'blackHole'>;

const PROJECTILE_SHAPE_FILL: Record<ProjectileKind, number> = {
  blackHole: 0x000000,
  inspectionProbe: 0x67e8f9,
  pusher: 0x67e8f9,
  shotgun: 0xffd166,
  small: 0xffffff,
};

const PROJECTILE_BASE_VISUAL_SCALE: Record<BodyRenderedProjectileKind, Vector> = {
  inspectionProbe: { x: 2.2, y: 0.72 },
  pusher: { x: 2.8, y: 0.72 },
  shotgun: { x: 1.8, y: 0.72 },
  small: { x: 2.1, y: 0.7 },
};

export function createProjectileShape(
  scene: Phaser.Scene,
  projectile: ProjectileEntity,
): MatterArc {
  const shape = scene.add.circle(
    projectile.position.x,
    projectile.position.y,
    projectile.radius,
    PROJECTILE_SHAPE_FILL[projectile.kind],
  );
  scene.matter.add.gameObject(shape, {
    circleRadius: projectile.radius,
    frictionAir: projectile.airResistance,
    isSensor: true,
  });
  const matterShape = shape as MatterArc;
  if (projectile.kind === 'blackHole') {
    matterShape.setVisible(false);
  } else if (projectile.kind === 'inspectionProbe') {
    matterShape.setStrokeStyle(1.5, 0xecfeff);
  }
  return matterShape;
}

export class ProjectileVisuals {
  private cameraPosition: Vector | null = null;
  private readonly screenPositions = new Map<number, Vector>();

  constructor(private readonly getShape: ShapeProvider) {}

  forget(projectile: ProjectileEntity): void {
    this.screenPositions.delete(projectile.id);
  }

  syncWorld(projectile: ProjectileEntity): void {
    const bodyRenderedKind = getBodyRenderedProjectileKind(projectile.kind);
    if (!bodyRenderedKind) return;
    syncProjectileVisual(
      this.getShape(projectile),
      bodyRenderedKind,
      projectile.velocity,
      projectile.angle,
      projectile.baseSpeed,
    );
  }

  syncCameraRelative(input: {
    camera: Phaser.Cameras.Scene2D.Camera;
    cameraVelocity?: Vector;
    projectiles: ProjectileEntity[];
    teleportThreshold: number;
  }): void {
    input.camera.preRender();
    const activeProjectileIds = new Set<number>();
    const cameraPosition = {
      x: input.camera.worldView.x,
      y: input.camera.worldView.y,
    };
    const cameraDelta = this.cameraPosition
      ? {
          x: cameraPosition.x - this.cameraPosition.x,
          y: cameraPosition.y - this.cameraPosition.y,
        }
      : { x: 0, y: 0 };
    this.cameraPosition = cameraPosition;

    for (const projectile of input.projectiles) {
      activeProjectileIds.add(projectile.id);
      this.syncApparentMotion(projectile, {
        camera: input.camera,
        initialCameraVelocity: input.cameraVelocity ?? cameraDelta,
        teleportThreshold: input.teleportThreshold,
      });
    }

    this.forgetInactive(activeProjectileIds);
  }

  private syncApparentMotion(
    projectile: ProjectileEntity,
    input: {
      camera: Phaser.Cameras.Scene2D.Camera;
      initialCameraVelocity: Vector;
      teleportThreshold: number;
    },
  ): void {
    const bodyRenderedKind = getBodyRenderedProjectileKind(projectile.kind);
    if (!bodyRenderedKind) return;
    const screenPosition = {
      x: projectile.position.x - input.camera.worldView.x,
      y: projectile.position.y - input.camera.worldView.y,
    };
    const previousScreenPosition = this.screenPositions.get(projectile.id);
    const visualVelocity = previousScreenPosition
      ? {
          x: screenPosition.x - previousScreenPosition.x,
          y: screenPosition.y - previousScreenPosition.y,
        }
      : {
          x: projectile.velocity.x - input.initialCameraVelocity.x,
          y: projectile.velocity.y - input.initialCameraVelocity.y,
        };
    this.screenPositions.set(projectile.id, screenPosition);
    syncProjectileVisual(
      this.getShape(projectile),
      bodyRenderedKind,
      isTeleportVelocity(visualVelocity, input.teleportThreshold)
        ? projectile.velocity
        : visualVelocity,
      projectile.angle,
      projectile.baseSpeed,
    );
  }

  private forgetInactive(activeProjectileIds: Set<number>): void {
    for (const projectileId of this.screenPositions.keys()) {
      if (!activeProjectileIds.has(projectileId)) this.screenPositions.delete(projectileId);
    }
  }
}

export function syncProjectileVisual(
  shape: MatterArc,
  kind: BodyRenderedProjectileKind,
  velocity: Vector | undefined,
  fallbackAngle: number,
  baseSpeed: number,
): void {
  const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0;
  const angle = velocity && speed > 0 ? Math.atan2(velocity.y, velocity.x) : fallbackAngle;
  const scale = getProjectileVisualScale(kind, speed, baseSpeed);
  shape.setScale(scale.x, scale.y).setRotation(angle);
}

export function getProjectileVisualScale(
  kind: BodyRenderedProjectileKind,
  speed: number,
  baseSpeed: number,
): Vector {
  const baseScale = PROJECTILE_BASE_VISUAL_SCALE[kind];
  const speedScale = baseSpeed > 0 ? clamp(speed / baseSpeed, 0.35, 2.25) : 1;
  return {
    x: baseScale.x * speedScale,
    y: baseScale.y,
  };
}

function getBodyRenderedProjectileKind(
  kind: ProjectileKind,
): BodyRenderedProjectileKind | null {
  return kind === 'blackHole' ? null : kind;
}

function isTeleportVelocity(velocity: Vector, teleportThreshold: number): boolean {
  return Math.hypot(velocity.x, velocity.y) > teleportThreshold;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
