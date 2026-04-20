export type SpriteSheetFrameSelector =
  | number
  | { column: number; row: number }
  | { name: string };

export type SpriteSheetGridConfig = {
  frameWidth: number;
  frameHeight: number;
  offsetX?: number;
  offsetY?: number;
  gapX?: number;
  gapY?: number;
  columns?: number;
  rows?: number;
  frameCount?: number;
  namedFrames?: Record<string, SpriteSheetFrameSelector>;
};

export type SpriteSheetFrame = {
  index: number;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DrawSpriteFrameOptions = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  originX?: number;
  originY?: number;
  rotation?: number;
  alpha?: number;
};

export type TilePlacement = {
  frame: SpriteSheetFrameSelector;
  tileX: number;
  tileY: number;
  width?: number;
  height?: number;
  rotation?: number;
  alpha?: number;
};

export type TilemapLayer = {
  tileWidth: number;
  tileHeight: number;
  offsetX?: number;
  offsetY?: number;
  tiles: TilePlacement[];
};
