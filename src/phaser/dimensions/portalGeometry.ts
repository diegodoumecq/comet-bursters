import type { Vector, WorldSize } from '../core/types';
import type { PortalEntity } from './types';

export function normalizeVector(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return { x: 1, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

export function getPortalTangent(portal: PortalEntity): Vector {
  return { x: -portal.normal.y, y: portal.normal.x };
}

export function getPortalLocalPosition(portal: PortalEntity, position: Vector): Vector {
  const tangent = getPortalTangent(portal);
  const delta = subtractVector(position, portal.position);
  return {
    x: dotVector(delta, tangent),
    y: dotVector(delta, portal.normal),
  };
}

export function portalApertureContainsCenter(portal: PortalEntity, position: Vector): boolean {
  const local = getPortalLocalPosition(portal, position);
  const x = local.x / Math.max(1, portal.aperture.radiusX);
  const y = local.y / Math.max(1, portal.aperture.radiusY);
  return x * x + y * y <= 1;
}

export function wrappedDistance(a: Vector, b: Vector, world: WorldSize): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.hypot(Math.min(dx, world.width - dx), Math.min(dy, world.height - dy));
}

export function addVector(a: Vector, b: Vector): Vector {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractVector(a: Vector, b: Vector): Vector {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVector(vector: Vector, scale: number): Vector {
  return { x: vector.x * scale, y: vector.y * scale };
}

export function dotVector(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

export function lerpVector(a: Vector, b: Vector, t: number): Vector {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}
