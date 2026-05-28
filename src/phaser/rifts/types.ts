import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import type { FuelBlobEntity } from '../fuel/types';
import type { ParticleEntity } from '../particles/types';
import type { PlayerState } from '../player/state';
import type { ProjectileEntity } from '../projectiles/types';

export type SpaceId = 'arcade' | 'rift';

export type SpaceMembership = {
  portalId?: number;
  space: SpaceId;
};

export type RiftLifecycleState = 'opening' | 'active' | 'draining' | 'closing' | 'disposed';
export type RiftAsteroidPortalStatus = 'insidePortal' | 'crossing' | 'emerged';

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
  fuelBlobs: FuelBlobEntity[];
  id: number;
  particles: ParticleEntity[];
  player: PlayerState | null;
  portal: RiftPortal;
  projectiles: ProjectileEntity[];
  size: WorldSize;
  state: RiftLifecycleState;
  timedOutAt: number | null;
};

export type RiftBurst = {
  portal: RiftPortal;
  sourceSpace: RiftSourceSpace;
};

export type RiftAsteroidTransition = {
  portal: RiftPortal;
  scenePosition: Vector;
  sourceAsteroid: RiftSourceAsteroid;
  status: RiftAsteroidPortalStatus;
};
