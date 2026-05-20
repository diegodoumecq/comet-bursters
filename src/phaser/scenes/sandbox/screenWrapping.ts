import type Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';
import { wrappedDelta } from '../../world/geometry';

type WrappedScreenProjectorInput = {
  camera: Phaser.Cameras.Scene2D.Camera;
  center?: Vector;
  screen: WorldSize;
  world: WorldSize;
};

export function createWrappedScreenProjector({
  camera,
  center,
  screen,
  world,
}: WrappedScreenProjectorInput): (position: Vector, radius: number) => Vector[] {
  return (position, radius) => {
    const viewportCenter = center ?? {
      x: camera.worldView.x + screen.width * 0.5,
      y: camera.worldView.y + screen.height * 0.5,
    };
    const viewport = {
      x: viewportCenter.x - screen.width * 0.5,
      y: viewportCenter.y - screen.height * 0.5,
    };
    const baseDelta = wrappedDelta(viewportCenter, position, world);
    const base = { x: viewportCenter.x + baseDelta.x, y: viewportCenter.y + baseDelta.y };
    const positions: Vector[] = [];

    for (let offsetX = -world.width; offsetX <= world.width; offsetX += world.width) {
      for (let offsetY = -world.height; offsetY <= world.height; offsetY += world.height) {
        const drawX = base.x + offsetX;
        const drawY = base.y + offsetY;
        if (
          drawX + radius >= viewport.x &&
          drawX - radius <= viewport.x + screen.width &&
          drawY + radius >= viewport.y &&
          drawY - radius <= viewport.y + screen.height
        ) {
          positions.push({
            x: drawX - viewport.x,
            y: drawY - viewport.y,
          });
        }
      }
    }

    return positions;
  };
}

export function getWrappedDistance(from: Vector, to: Vector, world: WorldSize): number {
  const delta = wrappedDelta(from, to, world);
  return Math.hypot(delta.x, delta.y);
}
