import type { Vector } from '../core/types';
import type { RiftPortal } from './types';

export function getRiftNormal(portal: RiftPortal): Vector {
  return { x: Math.cos(portal.angle), y: Math.sin(portal.angle) };
}

export function getRiftTangent(portal: RiftPortal): Vector {
  const normal = getRiftNormal(portal);
  return { x: -normal.y, y: normal.x };
}

export function projectRiftLocalToScene(portal: RiftPortal, localPosition: Vector): Vector {
  const normal = getRiftNormal(portal);
  const tangent = getRiftTangent(portal);
  return {
    x: portal.position.x + tangent.x * localPosition.x + normal.x * localPosition.y,
    y: portal.position.y + tangent.y * localPosition.x + normal.y * localPosition.y,
  };
}

export function getRiftSourceLocalPosition(portal: RiftPortal, sourcePosition: Vector): Vector {
  return {
    x: sourcePosition.x - portal.sourcePosition.x,
    y: sourcePosition.y - portal.sourcePosition.y,
  };
}

export function projectRiftSourceToScene(portal: RiftPortal, sourcePosition: Vector): Vector {
  return projectRiftLocalToScene(portal, getRiftSourceLocalPosition(portal, sourcePosition));
}

export function projectRiftLocalVectorToScene(portal: RiftPortal, localVector: Vector): Vector {
  const normal = getRiftNormal(portal);
  const tangent = getRiftTangent(portal);
  return {
    x: tangent.x * localVector.x + normal.x * localVector.y,
    y: tangent.y * localVector.x + normal.y * localVector.y,
  };
}

export function projectSceneVectorToRiftLocal(portal: RiftPortal, sceneVector: Vector): Vector {
  const normal = getRiftNormal(portal);
  const tangent = getRiftTangent(portal);
  return {
    x: sceneVector.x * tangent.x + sceneVector.y * tangent.y,
    y: sceneVector.x * normal.x + sceneVector.y * normal.y,
  };
}

export function pointIsInsidePortal(portal: RiftPortal, localPosition: Vector): boolean {
  const x = localPosition.x / portal.apertureRadiusX;
  const y = localPosition.y / portal.apertureRadiusY;
  return x * x + y * y <= 1;
}
