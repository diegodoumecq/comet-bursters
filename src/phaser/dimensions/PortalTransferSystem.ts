import type { WorldSize } from '../core/types';
import {
  dotVector,
  lerpVector,
  portalApertureContainsCenter,
  subtractVector,
} from './portalGeometry';
import type { PortalCrossing, PortalEntity, SpaceId, TransferableEntitySnapshot } from './types';
import { getOppositeSpace } from './types';

export function getPortalCrossing(input: {
  current: TransferableEntitySnapshot;
  portal: PortalEntity | null;
  world?: WorldSize;
}): PortalCrossing | null {
  const { current, portal, world } = input;
  if (!portal || portal.lifecycle !== 'active') return null;
  if (world && isWrappedDiscontinuity(current.previousPosition, current.position, world)) {
    return null;
  }

  const previousSide = dotVector(
    subtractVector(current.previousPosition, portal.position),
    portal.normal,
  );
  const currentSide = dotVector(subtractVector(current.position, portal.position), portal.normal);
  if (!crossedPortalPlane(previousSide, currentSide)) return null;
  if (!crossedAllowedDirection(current.membership.space, previousSide, currentSide)) return null;

  const t = previousSide / (previousSide - currentSide);
  const intersection = lerpVector(current.previousPosition, current.position, t);
  if (!portalApertureContainsCenter(portal, intersection)) return null;

  return {
    intersection,
    portal,
    toSpace: getOppositeSpace(current.membership.space),
  };
}

export function crossedPortalPlane(previousSide: number, currentSide: number): boolean {
  if (previousSide === 0 || currentSide === 0) return previousSide !== currentSide;
  return Math.sign(previousSide) !== Math.sign(currentSide);
}

export function crossedAllowedDirection(
  fromSpace: SpaceId,
  previousSide: number,
  currentSide: number,
): boolean {
  return fromSpace === 'arcade'
    ? previousSide > 0 && currentSide <= 0
    : previousSide < 0 && currentSide >= 0;
}

export function getPortalTransferCommands(input: {
  portal: PortalEntity | null;
  snapshots: TransferableEntitySnapshot[];
  world: WorldSize;
}): Array<{
  crossing: PortalCrossing;
  entity: TransferableEntitySnapshot;
  from: SpaceId;
  to: SpaceId;
}> {
  const commands: Array<{
    crossing: PortalCrossing;
    entity: TransferableEntitySnapshot;
    from: SpaceId;
    to: SpaceId;
  }> = [];
  for (const snapshot of input.snapshots) {
    const crossing = getPortalCrossing({
      current: snapshot,
      portal: input.portal,
      world: input.world,
    });
    if (crossing) {
      commands.push({
        crossing,
        entity: snapshot,
        from: snapshot.membership.space,
        to: crossing.toSpace,
      });
    }
  }
  return commands;
}

export function isWrappedDiscontinuity(
  previousPosition: TransferableEntitySnapshot['previousPosition'],
  position: TransferableEntitySnapshot['position'],
  world: WorldSize,
): boolean {
  return (
    Math.abs(position.x - previousPosition.x) > world.width * 0.5 ||
    Math.abs(position.y - previousPosition.y) > world.height * 0.5
  );
}
