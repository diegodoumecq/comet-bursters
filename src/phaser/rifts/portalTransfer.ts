import type { Vector } from '../core/types';
import { circleClearedPortalFront, circleOverlapsPortalAperture } from './sceneMembership';
import {
  arcadeToPortalLocal,
  arcadeToRift,
  arcadeVelocityToRift,
  riftToArcade,
  riftToPortalLocal,
  riftVelocityToArcade,
} from './transforms';
import type { RiftPortal, SpaceId, SpaceMembership } from './types';

export type TransferableBody = {
  membership: SpaceMembership;
  position: Vector;
  radius: number;
  velocity: Vector;
};

export type PortalTransferDecision = {
  membership: SpaceMembership;
  position: Vector;
  space: SpaceId;
  velocity: Vector;
};

export function getPortalTransferDecision(
  body: TransferableBody,
  portal: RiftPortal,
): PortalTransferDecision | null {
  if (body.membership.space === 'arcade') return getArcadeToRiftDecision(body, portal);
  return getRiftToArcadeDecision(body, portal);
}

function getArcadeToRiftDecision(
  body: TransferableBody,
  portal: RiftPortal,
): PortalTransferDecision | null {
  const localPosition = arcadeToPortalLocal(portal, body.position);
  const localVelocity = arcadeVelocityToRift(portal, body.velocity);
  const entering =
    localVelocity.y < 0 && circleOverlapsPortalAperture(localPosition, portal, body.radius);
  if (!entering) return null;
  return {
    membership: { portalId: portal.id, space: 'rift' },
    position: arcadeToRift(portal, body.position),
    space: 'rift',
    velocity: localVelocity,
  };
}

function getRiftToArcadeDecision(
  body: TransferableBody,
  portal: RiftPortal,
): PortalTransferDecision | null {
  if (body.membership.portalId !== portal.id) return null;
  const localPosition = riftToPortalLocal(portal, body.position);
  const exiting =
    body.velocity.y > 0 && circleClearedPortalFront(localPosition, portal, body.radius);
  if (!exiting) return null;
  return {
    membership: { space: 'arcade' },
    position: riftToArcade(portal, body.position),
    space: 'arcade',
    velocity: riftVelocityToArcade(portal, body.velocity),
  };
}
