import type Phaser from 'phaser';

import type { Vector, WorldSize } from '../core/types';
import { wrappedDelta } from './geometry';

type ScreenProjector = (position: Vector, radius: number) => Vector[];

type WrappedScreenProjectorInput = {
  camera: Phaser.Cameras.Scene2D.Camera;
  center?: Vector;
  screen: WorldSize;
  world: WorldSize;
};

type BoundedScreenProjectorInput = {
  camera: Phaser.Cameras.Scene2D.Camera;
  screen: WorldSize;
};

export type ScreenCaptureFrame = {
  origin: Vector;
  padding: number;
  size: WorldSize;
  visibleOrigin: Vector;
  visibleSize: WorldSize;
  zoom: number;
};

export function createWrappedScreenProjector({
  camera,
  center,
  screen,
  world,
}: WrappedScreenProjectorInput): ScreenProjector {
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
        if (intersectsViewport(drawX, drawY, radius, viewport, screen)) {
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

export function createBoundedScreenProjector({
  camera,
  screen,
}: BoundedScreenProjectorInput): ScreenProjector {
  return (position, radius) => {
    const viewport = {
      x: camera.worldView.x,
      y: camera.worldView.y,
    };
    const viewportSize = {
      height: camera.worldView.height || screen.height / Math.max(camera.zoom, 0.000001),
      width: camera.worldView.width || screen.width / Math.max(camera.zoom, 0.000001),
    };
    if (!intersectsViewport(position.x, position.y, radius, viewport, viewportSize)) return [];
    return [
      {
        x: (position.x - viewport.x) * camera.zoom,
        y: (position.y - viewport.y) * camera.zoom,
      },
    ];
  };
}

export function getCameraCaptureFrame(
  camera: Phaser.Cameras.Scene2D.Camera,
  screen: WorldSize,
  padding = 0,
): ScreenCaptureFrame {
  const zoom = Math.max(camera.zoom, 0.000001);
  const visibleSize = {
    height: camera.worldView.height || screen.height / zoom,
    width: camera.worldView.width || screen.width / zoom,
  };
  const worldPadding = padding / zoom;
  return {
    origin: {
      x: camera.worldView.x - worldPadding,
      y: camera.worldView.y - worldPadding,
    },
    padding,
    size: {
      height: screen.height + padding * 2,
      width: screen.width + padding * 2,
    },
    visibleOrigin: {
      x: camera.worldView.x,
      y: camera.worldView.y,
    },
    visibleSize,
    zoom,
  };
}

export function getStaticCaptureFrame(screen: WorldSize): ScreenCaptureFrame {
  return {
    origin: { x: 0, y: 0 },
    padding: 0,
    size: screen,
    visibleOrigin: { x: 0, y: 0 },
    visibleSize: screen,
    zoom: 1,
  };
}

function intersectsViewport(
  x: number,
  y: number,
  radius: number,
  viewport: Vector,
  screen: WorldSize,
): boolean {
  return (
    x + radius >= viewport.x &&
    x - radius <= viewport.x + screen.width &&
    y + radius >= viewport.y &&
    y - radius <= viewport.y + screen.height
  );
}
