import type Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';
import { wrappedDelta } from '../../world/geometry';

type WrappedScreenProjectorInput = {
  camera: Phaser.Cameras.Scene2D.Camera;
  screen: WorldSize;
  world: WorldSize;
};

export function createWrappedScreenProjector({
  camera,
  screen,
  world,
}: WrappedScreenProjectorInput): (position: Vector, radius: number) => Vector[] {
  return (position, radius) => {
    const center = {
      x: camera.worldView.x + screen.width * 0.5,
      y: camera.worldView.y + screen.height * 0.5,
    };
    const baseDelta = wrappedDelta(center, position, world);
    const base = { x: center.x + baseDelta.x, y: center.y + baseDelta.y };
    const positions: Vector[] = [];

    for (let offsetX = -world.width; offsetX <= world.width; offsetX += world.width) {
      for (let offsetY = -world.height; offsetY <= world.height; offsetY += world.height) {
        const drawX = base.x + offsetX;
        const drawY = base.y + offsetY;
        if (
          drawX + radius >= camera.worldView.x &&
          drawX - radius <= camera.worldView.x + screen.width &&
          drawY + radius >= camera.worldView.y &&
          drawY - radius <= camera.worldView.y + screen.height
        ) {
          positions.push({
            x: drawX - camera.worldView.x,
            y: drawY - camera.worldView.y,
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
