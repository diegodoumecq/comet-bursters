import type { Vector } from '../core/types';
import type { RiftPortal } from './types';

export function getScenePositionInRiftSpace(portal: RiftPortal, position: Vector): Vector {
  const normal = { x: Math.cos(portal.angle), y: Math.sin(portal.angle) };
  const tangent = { x: -normal.y, y: normal.x };
  const delta = {
    x: position.x - portal.position.x,
    y: position.y - portal.position.y,
  };
  return {
    x: delta.x * tangent.x + delta.y * tangent.y,
    y: delta.x * normal.x + delta.y * normal.y,
  };
}

export function circleOverlapsPortalAperture(
  localPosition: Vector,
  portal: RiftPortal,
  radius: number,
): boolean {
  const radiusX = portal.apertureRadiusX + radius;
  const radiusY = portal.apertureRadiusY + radius;
  return (
    (localPosition.x * localPosition.x) / (radiusX * radiusX) +
      (localPosition.y * localPosition.y) / (radiusY * radiusY) <=
    1
  );
}

export function circleClearedPortalFront(
  localPosition: Vector,
  portal: RiftPortal,
  radius: number,
): boolean {
  const normalizedX = Math.abs(localPosition.x) / Math.max(1, portal.apertureRadiusX);
  if (normalizedX > 1) return false;
  const boundary = portal.apertureRadiusY * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX));
  return localPosition.y - radius > boundary;
}

export function shouldEnterRift(input: {
  inRift: boolean;
  localPosition: Vector;
  localVelocity: Vector;
  portal: RiftPortal;
  radius: number;
}): boolean {
  return (
    !input.inRift &&
    input.localVelocity.y < 0 &&
    circleOverlapsPortalAperture(input.localPosition, input.portal, input.radius)
  );
}

export function shouldExitRift(input: {
  inRift: boolean;
  localPosition: Vector;
  localVelocity: Vector;
  portal: RiftPortal;
  radius: number;
}): boolean {
  return (
    input.inRift &&
    input.localVelocity.y > 0 &&
    circleClearedPortalFront(input.localPosition, input.portal, input.radius)
  );
}
