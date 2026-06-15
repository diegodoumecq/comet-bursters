import type { Vector, WorldSize } from '../core/types';

export type SpaceId = 'arcade' | 'rift';

export type SpaceMembership = {
  portalId?: number;
  space: SpaceId;
};

export type PortalLifecycle = 'openingVisual' | 'active' | 'closingVisual' | 'closed';

export type PortalViewPolicy = 'window' | 'cameraTransfer';

export type PortalAperture = {
  radiusX: number;
  radiusY: number;
};

export type PortalEntity = {
  activeDurationMs: number;
  aperture: PortalAperture;
  closeStartedAt: number | null;
  closingDurationMs: number;
  id: number;
  lifecycle: PortalLifecycle;
  normal: Vector;
  openedAt: number;
  openingDurationMs: number;
  position: Vector;
  viewPolicy: PortalViewPolicy;
  visualRadiusX: number;
  visualRadiusY: number;
};

export type ActiveViewState =
  | { space: SpaceId; type: 'stable' }
  | {
      durationMs: number;
      from: SpaceId;
      startedAt: number;
      to: SpaceId;
      type: 'transition';
    };

export type PortalCrossing = {
  intersection: Vector;
  portal: PortalEntity;
  toSpace: SpaceId;
};

export type TransferableEntityKind =
  | 'asteroid'
  | 'fuelBlob'
  | 'particle'
  | 'player'
  | 'projectile'
  | 'entity';

export type TransferableEntitySnapshot = {
  id: number | string;
  kind: TransferableEntityKind;
  membership: SpaceMembership;
  position: Vector;
  previousPosition: Vector;
};

export type PortalSpawnPlan = {
  asteroidCount: number;
  asteroidSpeed: number;
  spawnDistance: number;
  spreadRadius: number;
};

export type PortalPlacementInput = {
  now: number;
  playerPosition: Vector;
  portalId: number;
  world: WorldSize;
};

export type PortalDirectorPlan = {
  portal: PortalEntity;
  spawn: PortalSpawnPlan;
};

export type DimensionCommand =
  | { plan: PortalDirectorPlan; portal: PortalEntity; type: 'spawnPortal' }
  | { portalId: number; type: 'closePortal' }
  | {
      entity: TransferableEntitySnapshot;
      from: SpaceId;
      to: SpaceId;
      type: 'transferEntity';
    }
  | { hiddenSpace: SpaceId; type: 'cleanupHiddenWorld' }
  | { from: SpaceId; to: SpaceId; type: 'startCameraTransition' };

export function getOppositeSpace(space: SpaceId): SpaceId {
  return space === 'arcade' ? 'rift' : 'arcade';
}
