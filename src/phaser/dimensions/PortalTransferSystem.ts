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
}): PortalCrossing | null {
  const { current, portal } = input;
  if (!portal || portal.lifecycle !== 'active') return null;

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
    const crossing = getPortalCrossing({ current: snapshot, portal: input.portal });
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
