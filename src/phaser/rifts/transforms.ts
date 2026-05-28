import type { Vector } from '../core/types';
import { getRiftNormal, getRiftTangent } from './geometry';
import type { RiftPortal } from './types';

export function arcadeToPortalLocal(portal: RiftPortal, position: Vector): Vector {
  const normal = getRiftNormal(portal);
  const tangent = getRiftTangent(portal);
  const delta = {
    x: position.x - portal.position.x,
    y: position.y - portal.position.y,
  };
  return {
    x: delta.x * tangent.x + delta.y * tangent.y,
    y: delta.x * normal.x + delta.y * normal.y,
  };
}

export function portalLocalToArcade(portal: RiftPortal, localPosition: Vector): Vector {
  const normal = getRiftNormal(portal);
  const tangent = getRiftTangent(portal);
  return {
    x: portal.position.x + tangent.x * localPosition.x + normal.x * localPosition.y,
    y: portal.position.y + tangent.y * localPosition.x + normal.y * localPosition.y,
  };
}

export function riftToPortalLocal(portal: RiftPortal, position: Vector): Vector {
  return {
    x: position.x - portal.sourcePosition.x,
    y: position.y - portal.sourcePosition.y,
  };
}

export function portalLocalToRift(portal: RiftPortal, localPosition: Vector): Vector {
  return {
    x: portal.sourcePosition.x + localPosition.x,
    y: portal.sourcePosition.y + localPosition.y,
  };
}

export function arcadeToRift(portal: RiftPortal, position: Vector): Vector {
  return portalLocalToRift(portal, arcadeToPortalLocal(portal, position));
}

export function riftToArcade(portal: RiftPortal, position: Vector): Vector {
  return portalLocalToArcade(portal, riftToPortalLocal(portal, position));
}

export function arcadeVectorToPortalLocal(portal: RiftPortal, vector: Vector): Vector {
  const normal = getRiftNormal(portal);
  const tangent = getRiftTangent(portal);
  return {
    x: vector.x * tangent.x + vector.y * tangent.y,
    y: vector.x * normal.x + vector.y * normal.y,
  };
}

export function portalLocalVectorToArcade(portal: RiftPortal, vector: Vector): Vector {
  const normal = getRiftNormal(portal);
  const tangent = getRiftTangent(portal);
  return {
    x: tangent.x * vector.x + normal.x * vector.y,
    y: tangent.y * vector.x + normal.y * vector.y,
  };
}

export const arcadeVelocityToRift = arcadeVectorToPortalLocal;
export const riftVelocityToArcade = portalLocalVectorToArcade;
