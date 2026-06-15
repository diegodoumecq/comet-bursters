import type { AsteroidEntity } from '../asteroids/types';
import type { Vector, WorldSize } from '../core/types';
import type { PlanetEntity } from '../planets/types';
import type { NebulaRegionColor, NebulaRegionVisuals } from '../scenes/sandbox/nebulaRegions';
import type { GameEntity } from '../entities/types';

export type MinimapFog = {
  columns: number;
  dirtyCellIndices?: readonly number[];
  discoveredPlanetIds: Set<number>;
  exploredVersion?: number;
  exploredCells: Uint8Array;
  planetDiscoveryVersion?: number;
  rows: number;
  version: number;
  visibleVersion?: number;
  visibleCells: Uint8Array;
};

export type MinimapNebulaRegion = {
  alpha: number;
  points: Vector[];
  visuals?: NebulaRegionVisuals;
};

export type MinimapBiomeRegion = {
  color: NebulaRegionColor;
  points: Vector[];
};

export type MinimapRenderInput = {
  asteroids?: AsteroidEntity[];
  biomeRegions?: MinimapBiomeRegion[];
  camera: Phaser.Cameras.Scene2D.Camera;
  fog?: MinimapFog;
  nebulaRegions?: MinimapNebulaRegion[];
  planets: PlanetEntity[];
  player: Vector;
  playerRotation: number;
  playerVelocity: Vector;
  entities?: GameEntity[];
  viewportMode: 'bounded' | 'wrapped';
  world: WorldSize;
};
