import Phaser from 'phaser';

import type { Vector, WorldSize } from '../core/types';
import type { MinimapFog } from './types';

export const MINIMAP_WIDTH = 220;
export const MINIMAP_HEIGHT = 220;

const MINIMAP_PLAYER_HEADING_SPEED_EPSILON = 0.001;

export type MinimapScale = {
  x: number;
  y: number;
};

export type MinimapRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function getMinimapScale(world: WorldSize): MinimapScale {
  return {
    x: MINIMAP_WIDTH / world.width,
    y: MINIMAP_HEIGHT / world.height,
  };
}

export function projectWorldPoint(point: Vector, world: WorldSize, scale: MinimapScale): Vector {
  return {
    x: positiveModulo(point.x, world.width) * scale.x,
    y: positiveModulo(point.y, world.height) * scale.y,
  };
}

export function getFogCellIndex(position: Vector, fog: MinimapFog, world: WorldSize): number {
  const col = Math.floor((positiveModulo(position.x, world.width) / world.width) * fog.columns);
  const row = Math.floor((positiveModulo(position.y, world.height) / world.height) * fog.rows);
  return (
    Phaser.Math.Clamp(row, 0, fog.rows - 1) * fog.columns +
    Phaser.Math.Clamp(col, 0, fog.columns - 1)
  );
}

export function isVisibleOnMinimap(
  position: Vector,
  fog: MinimapFog | undefined,
  world: WorldSize,
): boolean {
  if (!fog) return true;
  return Boolean(fog.visibleCells[getFogCellIndex(position, fog, world)]);
}

export function getBoundedViewportRect(
  camera: Phaser.Cameras.Scene2D.Camera,
  scale: MinimapScale,
): MinimapRect {
  return {
    height: Math.min(MINIMAP_HEIGHT, camera.height * scale.y),
    width: Math.min(MINIMAP_WIDTH, camera.width * scale.x),
    x: camera.scrollX * scale.x,
    y: camera.scrollY * scale.y,
  };
}

export function getWrappedViewportRects(
  camera: Phaser.Cameras.Scene2D.Camera,
  world: WorldSize,
  scale: MinimapScale,
): MinimapRect[] {
  const boxX = positiveModulo(camera.scrollX, world.width) * scale.x;
  const boxY = positiveModulo(camera.scrollY, world.height) * scale.y;
  const boxWidth = Math.min(MINIMAP_WIDTH, camera.width * scale.x);
  const boxHeight = Math.min(MINIMAP_HEIGHT, camera.height * scale.y);
  const rects: MinimapRect[] = [];
  for (const offsetX of [0, -MINIMAP_WIDTH]) {
    for (const offsetY of [0, -MINIMAP_HEIGHT]) {
      const x = boxX + offsetX;
      const y = boxY + offsetY;
      if (x < MINIMAP_WIDTH && x + boxWidth > 0 && y < MINIMAP_HEIGHT && y + boxHeight > 0) {
        rects.push({ height: boxHeight, width: boxWidth, x, y });
      }
    }
  }
  return rects;
}

export function getMinimapPlayerHeading(velocity: Vector, fallbackRotation: number): number {
  if (Math.hypot(velocity.x, velocity.y) <= MINIMAP_PLAYER_HEADING_SPEED_EPSILON) {
    return fallbackRotation;
  }
  return Math.atan2(velocity.y, velocity.x);
}

export function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
