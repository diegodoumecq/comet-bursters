import type { PlayerHullHeightSample } from '../phaser/player/textures';

export type Point = {
  x: number;
  y: number;
};

export type HoverSample = {
  canvas: Point;
  point: Point;
  sample: PlayerHullHeightSample;
};

export type RenderMode = 'alpha' | 'height' | 'lit' | 'material' | 'normal';
