import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import type { ProjectileKind } from '../weapons/types';

export type RiftLifecycleState = 'opening' | 'active' | 'draining' | 'closing' | 'disposed';
export type RiftProjectionStatus = 'insidePortal' | 'crossing' | 'emerged';

export type RiftPortal = {
  angle: number;
  apertureRadiusX: number;
  apertureRadiusY: number;
  closeDurationMs: number;
  closeStartedAt: number | null;
  durationMs: number;
  id: number;
  openDurationMs: number;
  openedAt: number;
  position: Vector;
  radiusX: number;
  radiusY: number;
  sourcePosition: Vector;
  state: RiftLifecycleState;
};

export type RiftSourceAsteroid = {
  asteroid: AsteroidEntity;
  portalId: number;
  sourcePosition: Vector;
  sourceSpaceId: number;
};

export type RiftSourceSpace = {
  asteroids: RiftSourceAsteroid[];
  id: number;
  portal: RiftPortal;
  size: WorldSize;
  state: RiftLifecycleState;
  timedOutAt: number | null;
};

export type RiftBurst = {
  portal: RiftPortal;
  sourceSpace: RiftSourceSpace;
};

export type RiftProjection = {
  portal: RiftPortal;
  scenePosition: Vector;
  sourceAsteroid: RiftSourceAsteroid;
  status: RiftProjectionStatus;
};

export type RiftSceneProjection =
  | {
      kind: 'player';
      portal: RiftPortal;
      rotation: number;
      scale: number;
      scenePosition: Vector;
    }
  | {
      kind: 'projectile';
      portal: RiftPortal;
      projectileKind: ProjectileKind;
      radius: number;
      rotation: number;
      scenePosition: Vector;
    };
