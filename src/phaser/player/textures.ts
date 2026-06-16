import type Phaser from 'phaser';

import {
  ensureGeneratedAtlasTexture,
  ensureGeneratedCanvasTexture,
  type GeneratedAssetCacheEntry,
  type GeneratedAtlasTextureRender,
  type GeneratedCanvasTextureRecipe,
} from '../core/generatedAssetCache';
import type { GeneratedTextureGroup } from '../core/generatedTextureRegistry';
import type { WeaponKind } from '../weapons/types';
import { TURRET_SPRITE_DRAWERS, type TurretSpriteMetrics } from './turret';

export const PLAYER_TEXTURE_KEY = 'phaser-ship';
export const PLAYER_TURRET_TEXTURE_KEY = 'phaser-player-turret';
export const PLAYER_VISUAL_SIZE = 60;
export const PLAYER_HULL_TEXTURE_SIZE = PLAYER_VISUAL_SIZE * 2;
export const PLAYER_HULL_ROTATION_FRAME_COUNT = 48;
export const PLAYER_TURRET_TEXTURE_SIZE = PLAYER_VISUAL_SIZE * 2;
export const PLAYER_TURRET_MUZZLE_OFFSET = PLAYER_VISUAL_SIZE * 0.5 * 0.68;
export const PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS = 0;
export const PLAYER_HULL_DEFAULT_FRAME_KEY = createPlayerHullFrameKey(0);
export const PLAYER_TURRET_TEXTURE_KEYS: Record<WeaponKind, string> = {
  blackHole: 'phaser-player-turret-black-hole',
  fuelGun: 'phaser-player-turret-fuel-gun',
  inspectionProbe: 'phaser-player-turret-inspection-probe',
  pusher: 'phaser-player-turret-pusher',
  shotgun: 'phaser-player-turret-shotgun',
  small: PLAYER_TURRET_TEXTURE_KEY,
  tractor: 'phaser-player-turret-tractor',
};

const PLAYER_TEXTURE_ART_REVISION = 'bird-ship-heightmap-atlas-v2';
const FULL_ROTATION = Math.PI * 2;
const PLAYER_HULL_ATLAS_MAX_SIZE = 2048;
const PLAYER_HULL_LIGHT_DIRECTION = normalizePoint({ x: -0.58, y: -0.82 });
const HEIGHT_SAMPLE_STEP = 1 / PLAYER_HULL_TEXTURE_SIZE;
const SHIP_SHADE_BANDS = 4;
const FRAME_BLEND_START = 0.25;
const FRAME_BLEND_END = 0.75;

type AtlasFrameData = {
  frame: {
    h: number;
    w: number;
    x: number;
    y: number;
  };
  rotated: false;
  sourceSize: {
    h: number;
    w: number;
  };
  spriteSourceSize: {
    h: number;
    w: number;
    x: number;
    y: number;
  };
  trimmed: false;
};

type PlayerHullAtlasLayout = {
  columns: number;
  frameCount: number;
  height: number;
  rows: number;
  width: number;
};

export type PlayerHullTextureFrameRef = {
  frameAngle: number;
  frameKey: string;
  textureKey: string;
};

export type PlayerHullTextureBlend = {
  current: PlayerHullTextureFrameRef;
  nextAlpha: number;
  next: PlayerHullTextureFrameRef;
};

type Point = {
  x: number;
  y: number;
};

type ShipMaterial = 'beacon' | 'canopy' | 'engine' | 'hull' | 'shadow' | 'wing';

export type PlayerHullHeightSample = {
  alpha: number;
  edgeDistance: number;
  height: number;
  material: ShipMaterial;
};

export type PlayerTurretSpriteSpec = {
  /** Forward +X visual tip shared by every turret sprite. */
  length: number;
  orientationRadians: number;
  textureKey: string;
  textureSize: number;
};

export const PLAYER_TURRET_SPRITE_SPECS: Record<WeaponKind, PlayerTurretSpriteSpec> = {
  blackHole: createTurretSpriteSpec('blackHole'),
  fuelGun: createTurretSpriteSpec('fuelGun'),
  inspectionProbe: createTurretSpriteSpec('inspectionProbe'),
  pusher: createTurretSpriteSpec('pusher'),
  shotgun: createTurretSpriteSpec('shotgun'),
  small: createTurretSpriteSpec('small'),
  tractor: createTurretSpriteSpec('tractor'),
};

export async function ensurePlayerTextures(scene: Phaser.Scene): Promise<void> {
  await Promise.all([
    ensureGeneratedAtlasTexture(scene, createPlayerHullAtlasRecipe()),
    ...createPlayerTurretTextureRecipes().map((recipe) =>
      ensureGeneratedCanvasTexture(scene, recipe),
    ),
  ]);
}

export const PLAYER_GENERATED_TEXTURE_GROUP = {
  cacheEntries: getPlayerTextureCacheEntries(),
  ensure: ensurePlayerTextures,
  key: 'player',
  label: 'Player sprites',
  textureKeys: getPlayerTextureKeys(),
} satisfies GeneratedTextureGroup;

export function getPlayerTurretTextureKey(weapon: WeaponKind): string {
  return PLAYER_TURRET_TEXTURE_KEYS[weapon];
}

export function getPlayerHullTextureBlend(rotation: number): PlayerHullTextureBlend {
  const frame = getPlayerHullTextureFrame(rotation);
  const nextFrameIndex = (frame.index + 1) % PLAYER_HULL_ROTATION_FRAME_COUNT;
  return {
    current: createPlayerHullFrameRef(frame.index),
    nextAlpha: smoothstep(FRAME_BLEND_START, FRAME_BLEND_END, frame.progress),
    next: createPlayerHullFrameRef(nextFrameIndex),
  };
}

function createTurretSpriteSpec(weapon: WeaponKind): PlayerTurretSpriteSpec {
  return {
    length: PLAYER_TURRET_MUZZLE_OFFSET,
    orientationRadians: PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS,
    textureKey: PLAYER_TURRET_TEXTURE_KEYS[weapon],
    textureSize: PLAYER_TURRET_TEXTURE_SIZE,
  };
}

function createPlayerTurretTextureRecipes(): GeneratedCanvasTextureRecipe[] {
  return (Object.keys(PLAYER_TURRET_TEXTURE_KEYS) as WeaponKind[]).map((weapon) =>
    createPlayerTurretTextureRecipe(weapon),
  );
}

function getPlayerTextureCacheEntries(): GeneratedAssetCacheEntry[] {
  return [
    {
      textureKey: PLAYER_TEXTURE_KEY,
      version: createPlayerHullAtlasCacheVersion(),
    },
    ...createPlayerTurretTextureRecipes().map((recipe) => ({
      textureKey: recipe.key,
      version: recipe.version,
    })),
  ];
}

function getPlayerTextureKeys(): string[] {
  return [PLAYER_TEXTURE_KEY, ...createPlayerTurretTextureRecipes().map((recipe) => recipe.key)];
}

function createPlayerTurretTextureRecipe(weapon: WeaponKind): GeneratedCanvasTextureRecipe {
  return {
    draw: (ctx) => {
      ctx.translate(PLAYER_VISUAL_SIZE, PLAYER_VISUAL_SIZE);
      drawTurret(ctx, weapon);
    },
    height: PLAYER_TURRET_TEXTURE_SIZE,
    key: PLAYER_TURRET_TEXTURE_KEYS[weapon],
    version: createPlayerTextureCacheVersion(`turret-${weapon}`),
    width: PLAYER_TURRET_TEXTURE_SIZE,
  };
}

function createPlayerHullAtlasRecipe(): {
  key: string;
  renderAtlas: () => GeneratedAtlasTextureRender;
  version: string;
} {
  return {
    key: PLAYER_TEXTURE_KEY,
    renderAtlas: renderPlayerHullAtlas,
    version: createPlayerHullAtlasCacheVersion(),
  };
}

function renderPlayerHullAtlas(): GeneratedAtlasTextureRender {
  const layout = createPlayerHullAtlasLayout();
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = layout.width;
  atlasCanvas.height = layout.height;
  const context = atlasCanvas.getContext('2d');
  if (!context) throw new Error('Unable to create player hull atlas canvas');

  const frames: Record<string, AtlasFrameData> = {};
  for (let frameIndex = 0; frameIndex < layout.frameCount; frameIndex += 1) {
    const x = (frameIndex % layout.columns) * PLAYER_HULL_TEXTURE_SIZE;
    const y = Math.floor(frameIndex / layout.columns) * PLAYER_HULL_TEXTURE_SIZE;
    context.drawImage(renderPlayerHullFrame(getPlayerHullFrameAngle(frameIndex)), x, y);
    frames[createPlayerHullFrameKey(frameIndex)] = createAtlasFrameData(
      x,
      y,
      PLAYER_HULL_TEXTURE_SIZE,
    );
  }

  return { atlasJson: { frames }, canvas: atlasCanvas };
}

function renderPlayerHullFrame(frameAngle: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PLAYER_HULL_TEXTURE_SIZE;
  canvas.height = PLAYER_HULL_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create player hull canvas');

  const imageData = context.createImageData(PLAYER_HULL_TEXTURE_SIZE, PLAYER_HULL_TEXTURE_SIZE);
  const light = rotatePoint(PLAYER_HULL_LIGHT_DIRECTION, -frameAngle);
  for (let y = 0; y < PLAYER_HULL_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < PLAYER_HULL_TEXTURE_SIZE; x += 1) {
      const point = rotatePoint(texturePixelToShipPoint(x, y), -frameAngle);
      const sample = samplePlayerHullHeightMap(point);
      const index = (y * PLAYER_HULL_TEXTURE_SIZE + x) * 4;
      if (sample.alpha <= 0) {
        imageData.data[index + 3] = 0;
      } else {
        const color = shadePlayerHullSample(point, sample, light);
        imageData.data[index] = color.r;
        imageData.data[index + 1] = color.g;
        imageData.data[index + 2] = color.b;
        imageData.data[index + 3] = Math.round(sample.alpha * 255);
      }
    }
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function createPlayerHullAtlasLayout(): PlayerHullAtlasLayout {
  const maxColumns = Math.min(
    PLAYER_HULL_ROTATION_FRAME_COUNT,
    Math.floor(PLAYER_HULL_ATLAS_MAX_SIZE / PLAYER_HULL_TEXTURE_SIZE),
  );
  let best = {
    area: Number.POSITIVE_INFINITY,
    columns: 1,
    rows: PLAYER_HULL_ROTATION_FRAME_COUNT,
  };
  for (let columns = 1; columns <= maxColumns; columns += 1) {
    const rows = Math.ceil(PLAYER_HULL_ROTATION_FRAME_COUNT / columns);
    const area = columns * rows;
    const squareness = Math.abs(columns - rows) / Math.max(columns, rows);
    const bestSquareness = Math.abs(best.columns - best.rows) / Math.max(best.columns, best.rows);
    if (area < best.area || (area === best.area && squareness < bestSquareness))
      best = { area, columns, rows };
  }
  return {
    columns: best.columns,
    frameCount: PLAYER_HULL_ROTATION_FRAME_COUNT,
    height: best.rows * PLAYER_HULL_TEXTURE_SIZE,
    rows: best.rows,
    width: best.columns * PLAYER_HULL_TEXTURE_SIZE,
  };
}

function createPlayerHullAtlasCacheVersion(): string {
  const layout = createPlayerHullAtlasLayout();
  return [
    createPlayerTextureCacheVersion('hull-atlas'),
    PLAYER_HULL_ROTATION_FRAME_COUNT,
    PLAYER_HULL_TEXTURE_SIZE,
    layout.columns,
    layout.rows,
  ].join(':');
}

function createPlayerTextureCacheVersion(spriteKey: string): string {
  return [
    'player-texture',
    PLAYER_TEXTURE_ART_REVISION,
    PLAYER_VISUAL_SIZE,
    PLAYER_HULL_TEXTURE_SIZE,
    PLAYER_HULL_ROTATION_FRAME_COUNT,
    PLAYER_TURRET_TEXTURE_SIZE,
    PLAYER_TURRET_MUZZLE_OFFSET,
    PLAYER_TURRET_SPRITE_ORIENTATION_RADIANS,
    spriteKey,
  ].join(':');
}

export function drawFuelContour(
  base: Phaser.GameObjects.Graphics,
  fill: Phaser.GameObjects.Graphics,
  mask: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rotation: number,
  fuelRatio: number,
  now: number,
  scale = 1,
): void {
  const size = PLAYER_VISUAL_SIZE * 0.5 * scale;
  base.clear();
  fill.clear();
  mask.clear();
  base.setPosition(x, y);
  fill.setPosition(x, y);
  mask.setPosition(x, y);
  base.setRotation(rotation);
  fill.setRotation(rotation);
  mask.setRotation(rotation);
  if (fuelRatio <= 0.1) {
    const pulse = 0.45 + Math.sin(now / 120) * 0.35;
    base.lineStyle(2, 0xff232d, 0.45 + pulse * 0.3);
    strokeHull(base, size);
    return;
  }
  base.lineStyle(2, 0x2d3e55, 0.58);
  strokeHull(base, size);
  fill.lineStyle(2, 0x55f5ff, 0.82);
  strokeHull(fill, size);
  mask.fillStyle(0xffffff, 1);
  mask.fillRect(-size * 0.92, -size * 0.68, size * 1.92 * fuelRatio, size * 1.36);
}

const PLAYER_HULL_OUTLINE: readonly Point[] = [
  { x: 1, y: 0 },
  { x: 0.74, y: -0.09 },
  { x: 0.47, y: -0.14 },
  { x: 0.3, y: -0.24 },
  { x: 0.02, y: -0.62 },
  { x: -0.25, y: -0.5 },
  { x: -0.57, y: -0.37 },
  { x: -0.93, y: -0.26 },
  { x: -0.75, y: -0.13 },
  { x: -0.98, y: -0.08 },
  { x: -0.72, y: 0 },
  { x: -0.98, y: 0.08 },
  { x: -0.75, y: 0.13 },
  { x: -0.93, y: 0.26 },
  { x: -0.57, y: 0.37 },
  { x: -0.25, y: 0.5 },
  { x: 0.02, y: 0.62 },
  { x: 0.3, y: 0.24 },
  { x: 0.47, y: 0.14 },
  { x: 0.74, y: 0.09 },
];

const TOP_WING_PANEL: readonly Point[] = [
  { x: 0.28, y: -0.2 },
  { x: 0.01, y: -0.61 },
  { x: -0.25, y: -0.49 },
  { x: -0.91, y: -0.25 },
  { x: -0.54, y: -0.13 },
  { x: 0.1, y: -0.08 },
];

const BOTTOM_WING_PANEL: readonly Point[] = TOP_WING_PANEL.map((point) => ({
  x: point.x,
  y: -point.y,
}));

const TOP_TAIL_PANEL: readonly Point[] = [
  { x: -0.58, y: -0.08 },
  { x: -0.98, y: -0.08 },
  { x: -0.75, y: -0.01 },
];

const BOTTOM_TAIL_PANEL: readonly Point[] = TOP_TAIL_PANEL.map((point) => ({
  x: point.x,
  y: -point.y,
}));

export function samplePlayerHullHeightMap(point: Point): PlayerHullHeightSample {
  const inside = pointInPolygon(point, PLAYER_HULL_OUTLINE);
  if (!inside)
    return {
      alpha: 0,
      edgeDistance: 0,
      height: 0,
      material: 'shadow',
    };

  const edgeDistance = distanceToPolyline(point, PLAYER_HULL_OUTLINE, true);
  const alpha = smoothstep(0, 0.035, edgeDistance);
  const bodyDome = ellipseDome(point, { x: 0.11, y: 0 }, 0.88, 0.24);
  const noseDome = ellipseDome(point, { x: 0.58, y: 0 }, 0.4, 0.13);
  const topWing = pointInPolygon(point, TOP_WING_PANEL);
  const bottomWing = pointInPolygon(point, BOTTOM_WING_PANEL);
  const tail = pointInPolygon(point, TOP_TAIL_PANEL) || pointInPolygon(point, BOTTOM_TAIL_PANEL);
  let height = 0.18 + smoothstep(0, 0.2, edgeDistance) * 0.08;
  let material: ShipMaterial = 'wing';

  if (topWing || bottomWing) {
    const wingSign = point.y < 0 ? -1 : 1;
    const ridgeDistance = distanceToSegment(
      point,
      { x: 0.18, y: 0.16 * wingSign },
      {
        x: -0.78,
        y: 0.3 * wingSign,
      },
    );
    height = Math.max(height, 0.2 + smoothstep(0.3, 0.04, ridgeDistance) * 0.26);
  }

  if (bodyDome > 0) {
    height = Math.max(height, 0.32 + bodyDome * 0.54);
    material = 'hull';
  }

  if (noseDome > 0) {
    height = Math.max(height, 0.38 + noseDome * 0.5);
    material = 'hull';
  }

  if (tail) {
    height = Math.max(height, 0.32);
    material = 'engine';
  }

  const canopyDome = ellipseDome(point, { x: 0.18, y: 0 }, 0.3, 0.16);
  if (canopyDome > 0 && point.x < 0.42 && point.x > -0.18) {
    height = Math.max(height, 0.54 + canopyDome * 0.34);
    material = 'canopy';
  }

  const beaconDome = ellipseDome(point, { x: 0.74, y: 0 }, 0.07, 0.055);
  if (beaconDome > 0) {
    height = Math.max(height, 0.76 + beaconDome * 0.16);
    material = 'beacon';
  }

  if (isDarkVent(point)) {
    height = Math.min(height, 0.2);
    material = 'shadow';
  }

  return {
    alpha,
    edgeDistance,
    height: Math.min(1, height),
    material,
  };
}

function shadePlayerHullSample(
  point: Point,
  sample: PlayerHullHeightSample,
  light: Point,
): { b: number; g: number; r: number } {
  const normal = sampleHeightNormal(point);
  const facingLight = Math.max(0, normal.x * light.x + normal.y * light.y + normal.z * 0.78);
  const edgeShadow = 1 - smoothstep(0.018, 0.12, sample.edgeDistance);
  const panelShadow = getPanelLineAmount(point, sample.material);
  const shade = quantizeShade(
    0.24 + facingLight * 0.58 + sample.height * 0.16 - edgeShadow * 0.28 - panelShadow * 0.18,
  );
  const palette = getShipMaterialPalette(sample.material);
  let color = mixColor(palette.shadow, palette.mid, smoothstep(0.08, 0.62, shade));
  color = mixColor(color, palette.light, smoothstep(0.58, 1, shade));
  color = mixColor(color, { r: 12, g: 17, b: 26 }, edgeShadow * 0.86);
  color = mixColor(color, { r: 14, g: 20, b: 32 }, panelShadow * 0.42);
  const specular = Math.max(0, facingLight - 0.82) * smoothstep(0.2, 0.86, sample.height);
  return mixColor(color, palette.spark, specular * 0.38);
}

function sampleHeightNormal(point: Point): { x: number; y: number; z: number } {
  const left = samplePlayerHullHeightMap({ x: point.x - HEIGHT_SAMPLE_STEP, y: point.y }).height;
  const right = samplePlayerHullHeightMap({ x: point.x + HEIGHT_SAMPLE_STEP, y: point.y }).height;
  const up = samplePlayerHullHeightMap({ x: point.x, y: point.y - HEIGHT_SAMPLE_STEP }).height;
  const down = samplePlayerHullHeightMap({ x: point.x, y: point.y + HEIGHT_SAMPLE_STEP }).height;
  const strength = 5.4;
  const normal = {
    x: (left - right) * strength,
    y: (up - down) * strength,
    z: 1,
  };
  const length = Math.hypot(normal.x, normal.y, normal.z);
  return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
}

function getPanelLineAmount(point: Point, material: ShipMaterial): number {
  const centerSeam =
    point.x > -0.62 && point.x < 0.78 ? 1 - smoothstep(0.006, 0.024, Math.abs(point.y)) : 0;
  const topFeather = 1 - smoothstep(0.01, 0.038, distanceToPolyline(point, TOP_WING_PANEL, false));
  const bottomFeather =
    1 - smoothstep(0.01, 0.038, distanceToPolyline(point, BOTTOM_WING_PANEL, false));
  const shoulder =
    1 -
    smoothstep(
      0.006,
      0.026,
      distanceToSegment(
        point,
        { x: -0.1, y: 0 },
        {
          x: 0.32,
          y: point.y < 0 ? -0.2 : 0.2,
        },
      ),
    );
  const canopyRim = material === 'canopy' ? getCanopyRimAmount(point) : 0;
  return Math.max(centerSeam * 0.42, topFeather * 0.58, bottomFeather * 0.58, shoulder, canopyRim);
}

function getCanopyRimAmount(point: Point): number {
  const dx = (point.x - 0.18) / 0.3;
  const dy = point.y / 0.16;
  return 1 - smoothstep(0.08, 0.18, Math.abs(dx * dx + dy * dy - 1));
}

function isDarkVent(point: Point): boolean {
  return point.x > -0.7 && point.x < -0.42 && Math.abs(point.y) < 0.14;
}

function getShipMaterialPalette(material: ShipMaterial): {
  light: { b: number; g: number; r: number };
  mid: { b: number; g: number; r: number };
  shadow: { b: number; g: number; r: number };
  spark: { b: number; g: number; r: number };
} {
  if (material === 'canopy')
    return {
      light: { r: 179, g: 245, b: 255 },
      mid: { r: 79, g: 177, b: 221 },
      shadow: { r: 12, g: 45, b: 74 },
      spark: { r: 238, g: 255, b: 255 },
    };
  if (material === 'engine')
    return {
      light: { r: 255, g: 174, b: 72 },
      mid: { r: 102, g: 67, b: 74 },
      shadow: { r: 16, g: 22, b: 34 },
      spark: { r: 255, g: 233, b: 164 },
    };
  if (material === 'beacon')
    return {
      light: { r: 255, g: 255, b: 245 },
      mid: { r: 204, g: 239, b: 255 },
      shadow: { r: 88, g: 128, b: 158 },
      spark: { r: 255, g: 255, b: 255 },
    };
  if (material === 'shadow')
    return {
      light: { r: 51, g: 63, b: 82 },
      mid: { r: 28, g: 36, b: 53 },
      shadow: { r: 9, g: 13, b: 22 },
      spark: { r: 90, g: 111, b: 138 },
    };
  if (material === 'wing')
    return {
      light: { r: 235, g: 220, b: 205 },
      mid: { r: 125, g: 135, b: 151 },
      shadow: { r: 31, g: 41, b: 59 },
      spark: { r: 255, g: 244, b: 218 },
    };
  return {
    light: { r: 255, g: 255, b: 255 },
    mid: { r: 185, g: 202, b: 222 },
    shadow: { r: 47, g: 57, b: 76 },
    spark: { r: 255, g: 246, b: 215 },
  };
}

function drawTurret(ctx: CanvasRenderingContext2D, weapon: WeaponKind): void {
  const size = PLAYER_VISUAL_SIZE * 0.5;
  const metrics: TurretSpriteMetrics = {
    baseRadius: size * 0.24,
    length: PLAYER_TURRET_MUZZLE_OFFSET,
    mountX: size * 0.08,
    rearX: -size * 0.14,
  };
  TURRET_SPRITE_DRAWERS[weapon](ctx, metrics);
}

export function tracePlayerHull(graphics: Phaser.GameObjects.Graphics, size: number): void {
  graphics.beginPath();
  const first = PLAYER_HULL_OUTLINE[0];
  graphics.moveTo(first.x * size, first.y * size);
  for (let index = 1; index < PLAYER_HULL_OUTLINE.length; index += 1) {
    const point = PLAYER_HULL_OUTLINE[index];
    graphics.lineTo(point.x * size, point.y * size);
  }
  graphics.closePath();
}

export function fillPlayerHull(graphics: Phaser.GameObjects.Graphics, size: number): void {
  tracePlayerHull(graphics, size);
  graphics.fillPath();
}

export function strokePlayerHull(graphics: Phaser.GameObjects.Graphics, size: number): void {
  tracePlayerHull(graphics, size);
  graphics.strokePath();
}

function strokeHull(graphics: Phaser.GameObjects.Graphics, size: number): void {
  strokePlayerHull(graphics, size);
}

function createAtlasFrameData(x: number, y: number, textureSize: number): AtlasFrameData {
  return {
    frame: { h: textureSize, w: textureSize, x, y },
    rotated: false,
    sourceSize: { h: textureSize, w: textureSize },
    spriteSourceSize: { h: textureSize, w: textureSize, x: 0, y: 0 },
    trimmed: false,
  };
}

function createPlayerHullFrameKey(frameIndex: number): string {
  return `phaser-ship-hull-frame-${frameIndex}`;
}

function createPlayerHullFrameRef(frameIndex: number): PlayerHullTextureFrameRef {
  return {
    frameAngle: getPlayerHullFrameAngle(frameIndex),
    frameKey: createPlayerHullFrameKey(frameIndex),
    textureKey: PLAYER_TEXTURE_KEY,
  };
}

function getPlayerHullTextureFrame(rotation: number): { index: number; progress: number } {
  const normalized = normalizeRotation(rotation);
  const frame = (normalized / FULL_ROTATION) * PLAYER_HULL_ROTATION_FRAME_COUNT;
  const index = Math.floor(frame) % PLAYER_HULL_ROTATION_FRAME_COUNT;
  return { index, progress: frame - Math.floor(frame) };
}

function getPlayerHullFrameAngle(frameIndex: number): number {
  return (frameIndex / PLAYER_HULL_ROTATION_FRAME_COUNT) * FULL_ROTATION;
}

function texturePixelToShipPoint(x: number, y: number): Point {
  return {
    x: (x + 0.5 - PLAYER_HULL_TEXTURE_SIZE * 0.5) / (PLAYER_VISUAL_SIZE * 0.5),
    y: (y + 0.5 - PLAYER_HULL_TEXTURE_SIZE * 0.5) / (PLAYER_VISUAL_SIZE * 0.5),
  };
}

function ellipseDome(point: Point, center: Point, radiusX: number, radiusY: number): number {
  const dx = (point.x - center.x) / radiusX;
  const dy = (point.y - center.y) / radiusY;
  return Math.max(0, 1 - dx * dx - dy * dy);
}

function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  let previousIndex = polygon.length - 1;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const intersectionX =
      ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (crossesY && point.x < intersectionX) inside = !inside;
    previousIndex = index;
  }
  return inside;
}

function distanceToPolyline(point: Point, points: readonly Point[], closed: boolean): number {
  let distance = Number.POSITIVE_INFINITY;
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const nextIndex = (index + 1) % points.length;
    distance = Math.min(distance, distanceToSegment(point, points[index], points[nextIndex]));
  }
  return distance;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared <= 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + segmentX * t), point.y - (start.y + segmentY * t));
}

function quantizeShade(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  const band = Math.min(SHIP_SHADE_BANDS - 1, Math.floor(clamped * SHIP_SHADE_BANDS));
  return band / Math.max(1, SHIP_SHADE_BANDS - 1);
}

function mixColor(
  from: { b: number; g: number; r: number },
  to: { b: number; g: number; r: number },
  amount: number,
): { b: number; g: number; r: number } {
  const clamped = Math.max(0, Math.min(1, amount));
  return {
    b: Math.round(from.b + (to.b - from.b) * clamped),
    g: Math.round(from.g + (to.g - from.g) * clamped),
    r: Math.round(from.r + (to.r - from.r) * clamped),
  };
}

function rotatePoint(point: Point, angle: number): Point {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function normalizePoint(point: Point): Point {
  const length = Math.hypot(point.x, point.y);
  return length > 0 ? { x: point.x / length, y: point.y / length } : { x: 1, y: 0 };
}

function normalizeRotation(rotation: number): number {
  return ((rotation % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const min = Math.min(edge0, edge1);
  const max = Math.max(edge0, edge1);
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const eased = t * t * (3 - 2 * t);
  return edge0 <= edge1 ? eased : 1 - eased;
}
