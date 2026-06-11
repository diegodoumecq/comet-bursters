import Phaser from 'phaser';

import {
  createShaderCanvases,
  hexToVec3Uniform,
  setFloatUniform,
  setVec2Uniform,
  setVec3Uniform,
} from '../core/shaderTextures';
import type { ShaderCanvasOutput, ShaderTextureInput } from '../core/shaderTextures';
import { ASTEROIDS } from './config';
import type { AsteroidTier } from './types';

const ASTEROID_SURFACE_VARIANTS = ['cartoon-lumpy', 'cartoon-scorched'] as const;
const FULL_ROTATION = Math.PI * 2;

type AsteroidSurfaceVariant = (typeof ASTEROID_SURFACE_VARIANTS)[number];

type SurfaceStyle = 'lumpy' | 'scorched';

type SurfaceRecipe = {
  accent?: string;
  accentAmount: number;
  bandCount: number;
  craters: number;
  facets: number;
  key: AsteroidSurfaceVariant;
  shape: number;
  style: SurfaceStyle;
  tint: string;
  tintAmount: number;
};

type AsteroidTextureFrameRef = {
  frameKey: string;
  textureKey: string;
};

type AsteroidAtlasLayout = {
  columns: number;
  frameCount: number;
  height: number;
  pageIndex: number;
  startFrame: number;
  textureKey: string;
  width: number;
};

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

export const ASTEROID_TEXTURES: Record<AsteroidTier, readonly string[]> = {
  mega: createTextureKeys('mega'),
  big: createTextureKeys('big'),
  medium: createTextureKeys('medium'),
  small: createTextureKeys('small'),
};

const TIER_BASE_COLORS: Record<AsteroidTier, string> = {
  mega: '#ff6b6b',
  big: '#ffd93d',
  medium: '#6bcb77',
  small: '#4d96ff',
};

const TIER_ROTATION_FRAME_COUNTS: Record<AsteroidTier, number> = {
  mega: 96,
  big: 72,
  medium: 48,
  small: 48,
};

const SURFACE_RECIPES: readonly SurfaceRecipe[] = [
  {
    accentAmount: 0.08,
    bandCount: 4,
    craters: 0.38,
    facets: 0.38,
    key: 'cartoon-lumpy',
    shape: 0.78,
    style: 'lumpy',
    tint: '#95866f',
    tintAmount: 0.16,
  },
  {
    accent: '#ff9d5c',
    accentAmount: 0.34,
    bandCount: 3,
    craters: 0.54,
    facets: 0.52,
    key: 'cartoon-scorched',
    shape: 0.86,
    style: 'scorched',
    tint: '#4b4144',
    tintAmount: 0.28,
  },
];

const SURFACE_STYLE_INDEX: Record<SurfaceStyle, number> = {
  lumpy: 0,
  scorched: 1,
};

const ASTEROID_TEXTURE_PADDING = 4;
const ASTEROID_ATLAS_MAX_SIZE = 2048;
const DEFAULT_ACCENT_COLOR = '#ffffff';
const FRAME_BLEND_START = 0.25;
const FRAME_BLEND_END = 0.75;

export type AsteroidTextureBlend = {
  current: AsteroidTextureFrameRef;
  nextAlpha: number;
  next: AsteroidTextureFrameRef;
};

const fragmentShader = `
precision highp float;

uniform float u_accent_amount;
uniform float u_band_count;
uniform float u_crater_amount;
uniform float u_detail_scale;
uniform float u_facet_amount;
uniform float u_radius;
uniform float u_rotation;
uniform float u_seed;
uniform float u_shape_amount;
uniform float u_style;
uniform vec2 u_texture_size;
uniform vec3 u_accent_color;
uniform vec3 u_base_color;

mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33 + u_seed * 0.013);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  float x = hash12(p + 19.19);
  float y = hash12(p + 73.73);
  return vec2(x, y);
}

float styleMask(float style) {
  return 1.0 - step(0.5, abs(u_style - style));
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float softNoise(vec2 p) {
  float first = valueNoise(p) * 0.68;
  float second = valueNoise(p * 2.03 + vec2(5.7, 2.1)) * 0.32;
  return first + second;
}

vec3 cellularPatches(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float nearest = 8.0;
  float secondNearest = 8.0;
  float nearestId = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = neighbor + hash22(cell + neighbor) * 0.58 + 0.21;
      float distanceToPoint = length(local - point);
      if (distanceToPoint < nearest) {
        secondNearest = nearest;
        nearest = distanceToPoint;
        nearestId = hash12(cell + neighbor + 127.7);
      } else if (distanceToPoint < secondNearest) {
        secondNearest = distanceToPoint;
      }
    }
  }
  return vec3(nearest, secondNearest - nearest, nearestId);
}

float angularNoise(float angle, float scale, float offset) {
  vec2 direction = vec2(cos(angle), sin(angle));
  return valueNoise(direction * scale + offset + u_seed * 0.017);
}

float silhouetteRadius(vec2 uv) {
  float angle = atan(uv.y, uv.x);
  float lumpy = styleMask(0.0);
  float segmentCount = 6.0;
  float segment = floor((angle + 3.14159) / 6.28318 * segmentCount) / segmentCount;
  float segmentAngle = segment * 6.28318;
  float broad =
    (angularNoise(angle, 1.2, 2.1) - 0.5) * (0.22 + u_shape_amount * 0.1 + lumpy * 0.08) +
    (angularNoise(angle, 2.7, 8.4) - 0.5) * (0.13 + u_shape_amount * 0.08);
  float block = (angularNoise(segmentAngle, 3.1, 31.7) - 0.5) * 0.11;
  float bite = smoothstep(0.74, 0.98, angularNoise(angle, 7.4, 14.8)) *
    angularNoise(angle, 12.0, 5.7) *
    (0.04 + u_shape_amount * 0.04);
  return clamp(0.92 + broad + block - bite, 0.68, 1.22);
}

vec3 craterData(vec2 uv) {
  float scorched = styleMask(1.0);
  float scale = (2.7 + scorched * 1.4) * u_detail_scale;
  vec2 p = uv * scale + u_seed * 0.031;
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float nearest = 8.0;
  float craterId = 0.0;
  vec2 craterVector = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = neighbor + hash22(cell + neighbor) * 0.62 + 0.19;
      vec2 offset = local - point;
      float distanceToPoint = length(offset);
      if (distanceToPoint < nearest) {
        nearest = distanceToPoint;
        craterId = hash12(cell + neighbor + 211.9);
        craterVector = offset;
      }
    }
  }
  float threshold = 0.62 - scorched * 0.08;
  float gate = smoothstep(threshold, 1.0, craterId) * u_crater_amount;
  float bowl = (1.0 - smoothstep(0.07, 0.25, nearest)) * gate;
  float rim = smoothstep(0.13, 0.22, nearest) * (1.0 - smoothstep(0.22, 0.36, nearest)) * gate;
  vec2 craterNormal = normalize(craterVector + vec2(0.0001));
  float lightSide = dot(craterNormal, normalize(vec2(-0.54, 0.72)));
  return vec3(bowl, rim, lightSide);
}

vec3 cartoonSurface(vec2 uv, vec2 lightUv, float radial) {
  float lumpy = styleMask(0.0);
  float scorched = styleMask(1.0);
  float facetScale = 1.85 + u_facet_amount * 2.15 - lumpy * 0.35;
  vec3 cells = cellularPatches(uv * facetScale + u_seed * 0.004);
  float patchValue = floor((cells.z + softNoise(uv * 1.4 + cells.z) * 0.36) * 3.0) / 3.0;
  float lowBlob = softNoise(uv * (1.55 + lumpy * 0.75) + vec2(4.2, -1.7));
  vec3 crater = craterData(uv);
  vec2 light2 = normalize(vec2(-0.58, 0.72));
  float facingLight = dot(normalize(lightUv + vec2(0.0001)), light2);
  float roundLight = smoothstep(-0.46, 0.82, facingLight) * 0.5 + (1.0 - radial) * 0.22;
  float facetLight = (patchValue - 0.5) * (0.22 + u_facet_amount * 0.2);
  float lumpyLight = (lowBlob - 0.5) * (0.18 + lumpy * 0.12);
  float shade = 0.43 + roundLight + facetLight + lumpyLight;
  shade -= crater.x * (0.22 + scorched * 0.14);
  shade -= smoothstep(0.58, 1.02, radial) * 0.2;
  shade += crater.y * max(crater.z, 0.0) * 0.18;
  float steppedShade = floor(clamp(shade, 0.0, 1.0) * u_band_count) / max(u_band_count - 1.0, 1.0);
  vec3 shadowColor = u_base_color * vec3(0.42, 0.39, 0.43);
  vec3 midColor = u_base_color * vec3(0.82, 0.78, 0.72);
  vec3 lightColor = mix(u_base_color, vec3(1.0, 0.94, 0.76), 0.34);
  vec3 color = mix(shadowColor, midColor, smoothstep(0.24, 0.58, steppedShade));
  color = mix(color, lightColor, smoothstep(0.62, 1.0, steppedShade));
  float craterInk = crater.x * (0.48 + scorched * 0.16);
  color = mix(color, vec3(0.11, 0.09, 0.11), craterInk);
  color = mix(color, lightColor, crater.y * max(crater.z, 0.0) * 0.18);
  float scorchGlow = smoothstep(0.62, 1.0, lowBlob) * crater.x * scorched;
  color = mix(color, u_accent_color, scorchGlow * u_accent_amount);
  float highlight = smoothstep(0.35, 0.95, facingLight) * smoothstep(0.28, 0.78, radial) * (1.0 - smoothstep(0.78, 1.0, radial));
  color = mix(color, vec3(1.0, 0.95, 0.78), highlight * 0.16);
  color = mix(color, vec3(0.09, 0.07, 0.06), scorched * smoothstep(0.74, 0.98, softNoise(uv * 4.6 - u_seed * 0.01)) * 0.36);
  return clamp(color, vec3(0.0), vec3(1.0));
}

void main() {
  vec2 centered = (gl_FragCoord.xy - u_texture_size * 0.5) / u_radius;
  vec2 uv = rotate2d(u_rotation) * centered;
  float radial = length(uv);
  float edge = silhouetteRadius(uv);
  float distanceToEdge = edge - radial;
  float alpha = smoothstep(-0.012, 0.012, distanceToEdge);
  if (alpha <= 0.001) {
    gl_FragColor = vec4(0.0);
  } else {
    vec2 surfaceUv = uv / max(edge, 0.001);
    float surfaceRadial = radial / max(edge, 0.001);
    vec2 lightUv = centered / max(edge, 0.001);
    vec3 color = cartoonSurface(surfaceUv, lightUv, surfaceRadial);
    float outline = 1.0 - smoothstep(0.02, 0.085, distanceToEdge);
    float innerRim = smoothstep(0.76, 1.0, surfaceRadial) *
      smoothstep(0.1, 0.85, dot(normalize(lightUv + vec2(0.0001)), normalize(vec2(-0.58, 0.72))));
    color = mix(color, vec3(0.055, 0.047, 0.065), outline * 0.94);
    color = mix(color, vec3(1.0, 0.91, 0.62), innerRim * 0.14 * (1.0 - outline));
    gl_FragColor = vec4(color, alpha);
  }
}
`;

export function createAsteroidTextures(scene: Phaser.Scene): void {
  for (const tier of Object.keys(ASTEROIDS) as AsteroidTier[]) {
    const frameCount = TIER_ROTATION_FRAME_COUNTS[tier];
    SURFACE_RECIPES.forEach((recipe, variantIndex) => {
      createAsteroidTextureAtlas(scene, tier, recipe, variantIndex, frameCount);
    });
  }
}

export function getAsteroidTextureFrameRef(
  tier: AsteroidTier,
  visualVariant: number,
  rotation: number,
): AsteroidTextureFrameRef {
  const variant = getAsteroidSurfaceVariant(visualVariant);
  return createAsteroidAtlasFrameRef(tier, variant, getAsteroidTextureFrameIndex(tier, rotation));
}

export function getAsteroidTextureBlend(
  tier: AsteroidTier,
  visualVariant: number,
  rotation: number,
): AsteroidTextureBlend {
  const variant = getAsteroidSurfaceVariant(visualVariant);
  const frameCount = TIER_ROTATION_FRAME_COUNTS[tier];
  const frame = getAsteroidTextureFrame(tier, rotation);
  const nextFrameIndex = (frame.index + 1) % frameCount;
  return {
    current: createAsteroidAtlasFrameRef(tier, variant, frame.index),
    nextAlpha: smoothstep(FRAME_BLEND_START, FRAME_BLEND_END, frame.progress),
    next: createAsteroidAtlasFrameRef(tier, variant, nextFrameIndex),
  };
}

export function getAsteroidTextureDisplaySize(tier: AsteroidTier): number {
  return ASTEROIDS[tier].radius * 2;
}

function createAsteroidShaderTextureInput(
  textureKey: string,
  textureSize: number,
  radius: number,
  tier: AsteroidTier,
  recipe: SurfaceRecipe,
  frameIndex: number,
  frameCount: number,
): ShaderTextureInput {
  const baseColor = mixHexColor(TIER_BASE_COLORS[tier], recipe.tint, recipe.tintAmount);
  return {
    setUniforms: (gl, program) => {
      setFloatUniform(gl, program, 'u_accent_amount', recipe.accentAmount);
      setFloatUniform(gl, program, 'u_band_count', recipe.bandCount);
      setFloatUniform(gl, program, 'u_crater_amount', recipe.craters);
      setFloatUniform(gl, program, 'u_detail_scale', getTierDetailScale(tier));
      setFloatUniform(gl, program, 'u_facet_amount', recipe.facets);
      setFloatUniform(gl, program, 'u_radius', radius);
      setFloatUniform(
        gl,
        program,
        'u_rotation',
        seededAngle(`${tier}:${recipe.key}:rotation`) + getFrameAngle(frameIndex, frameCount),
      );
      setFloatUniform(gl, program, 'u_seed', shaderSeed(`${tier}:${recipe.key}`));
      setFloatUniform(gl, program, 'u_shape_amount', recipe.shape);
      setFloatUniform(gl, program, 'u_style', SURFACE_STYLE_INDEX[recipe.style]);
      setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
      setVec3Uniform(
        gl,
        program,
        'u_accent_color',
        hexToVec3Uniform(recipe.accent ?? DEFAULT_ACCENT_COLOR),
      );
      setVec3Uniform(gl, program, 'u_base_color', hexToVec3Uniform(baseColor));
    },
    textureKey,
    textureSize,
  };
}

function createTextureKeys(tier: AsteroidTier): readonly string[] {
  return ASTEROID_SURFACE_VARIANTS.map((variant) => createAtlasTextureKey(tier, variant, 0));
}

function createAsteroidTextureAtlas(
  scene: Phaser.Scene,
  tier: AsteroidTier,
  recipe: SurfaceRecipe,
  variantIndex: number,
  frameCount: number,
): void {
  const textureSize = getAsteroidTextureSize(tier);
  const layouts = createAtlasLayouts(tier, recipe.key, frameCount, textureSize);
  if (layouts.every((layout) => scene.textures.exists(layout.textureKey))) return;

  const inputs = createAsteroidShaderTextureInputs(
    tier,
    recipe,
    variantIndex,
    frameCount,
    textureSize,
  );
  const outputs = createShaderCanvases(fragmentShader, inputs);
  if (!outputs) throw new Error('Unable to create asteroid shader textures');

  for (const layout of layouts) {
    if (!scene.textures.exists(layout.textureKey))
      createAsteroidAtlasPage(scene, tier, recipe.key, layout, textureSize, outputs);
  }
}

function createAsteroidShaderTextureInputs(
  tier: AsteroidTier,
  recipe: SurfaceRecipe,
  variantIndex: number,
  frameCount: number,
  textureSize: number,
): ShaderTextureInput[] {
  const inputs: ShaderTextureInput[] = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    inputs.push(
      createAsteroidShaderTextureInput(
        createFrameTextureKey(tier, getAsteroidSurfaceVariant(variantIndex), frameIndex),
        textureSize,
        ASTEROIDS[tier].radius,
        tier,
        recipe,
        frameIndex,
        frameCount,
      ),
    );
  }
  return inputs;
}

function createAsteroidAtlasPage(
  scene: Phaser.Scene,
  tier: AsteroidTier,
  variant: AsteroidSurfaceVariant,
  layout: AsteroidAtlasLayout,
  textureSize: number,
  outputs: readonly ShaderCanvasOutput[],
): void {
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = layout.width;
  atlasCanvas.height = layout.height;
  const context = atlasCanvas.getContext('2d');
  if (!context) throw new Error('Unable to create asteroid atlas canvas');

  const frames: Record<string, AtlasFrameData> = {};
  for (let frameOffset = 0; frameOffset < layout.frameCount; frameOffset += 1) {
    const frameIndex = layout.startFrame + frameOffset;
    const output = outputs[frameIndex];
    if (!output) throw new Error(`Missing asteroid frame ${frameIndex}`);

    const x = (frameOffset % layout.columns) * textureSize;
    const y = Math.floor(frameOffset / layout.columns) * textureSize;
    context.drawImage(output.canvas, x, y);
    frames[createFrameTextureKey(tier, variant, frameIndex)] = createAtlasFrameData(
      x,
      y,
      textureSize,
    );
  }

  const atlas = scene.textures.addAtlasJSONHash(
    layout.textureKey,
    atlasCanvas as unknown as HTMLImageElement,
    { frames },
  );
  if (!atlas) throw new Error(`Unable to create asteroid atlas ${layout.textureKey}`);
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

function createAsteroidAtlasFrameRef(
  tier: AsteroidTier,
  variant: AsteroidSurfaceVariant,
  frameIndex: number,
): AsteroidTextureFrameRef {
  return {
    frameKey: createFrameTextureKey(tier, variant, frameIndex),
    textureKey: createAtlasTextureKey(
      tier,
      variant,
      getAtlasPageIndex(frameIndex, getAsteroidTextureSize(tier)),
    ),
  };
}

function createAtlasLayouts(
  tier: AsteroidTier,
  variant: AsteroidSurfaceVariant,
  frameCount: number,
  frameSize: number,
): AsteroidAtlasLayout[] {
  const framesPerPage = getAtlasFramesPerPage(frameSize);
  const layouts: AsteroidAtlasLayout[] = [];
  for (let startFrame = 0; startFrame < frameCount; startFrame += framesPerPage) {
    const pageFrameCount = Math.min(framesPerPage, frameCount - startFrame);
    const pageIndex = getAtlasPageIndex(startFrame, frameSize);
    const grid = chooseAtlasGrid(pageFrameCount, frameSize);
    layouts.push({
      columns: grid.columns,
      frameCount: pageFrameCount,
      height: grid.rows * frameSize,
      pageIndex,
      startFrame,
      textureKey: createAtlasTextureKey(tier, variant, pageIndex),
      width: grid.columns * frameSize,
    });
  }
  return layouts;
}

function chooseAtlasGrid(frameCount: number, frameSize: number): { columns: number; rows: number } {
  const maxColumns = Math.min(frameCount, Math.floor(ASTEROID_ATLAS_MAX_SIZE / frameSize));
  let best = { area: Number.POSITIVE_INFINITY, columns: 1, rows: frameCount };
  for (let columns = 1; columns <= maxColumns; columns += 1) {
    const rows = Math.ceil(frameCount / columns);
    const area = columns * rows;
    const squareness = Math.abs(columns - rows) / Math.max(columns, rows);
    const bestSquareness = Math.abs(best.columns - best.rows) / Math.max(best.columns, best.rows);
    if (area < best.area || (area === best.area && squareness < bestSquareness))
      best = { area, columns, rows };
  }
  return { columns: best.columns, rows: best.rows };
}

function getAtlasPageIndex(frameIndex: number, frameSize: number): number {
  return Math.floor(frameIndex / getAtlasFramesPerPage(frameSize));
}

function getAtlasFramesPerPage(frameSize: number): number {
  const framesPerAxis = Math.max(1, Math.floor(ASTEROID_ATLAS_MAX_SIZE / frameSize));
  return framesPerAxis * framesPerAxis;
}

function createAtlasTextureKey(
  tier: AsteroidTier,
  variant: AsteroidSurfaceVariant,
  pageIndex: number,
): string {
  return `phaser-asteroid-${tier}-${variant}-atlas-${pageIndex}`;
}

function createFrameTextureKey(
  tier: AsteroidTier,
  variant: AsteroidSurfaceVariant,
  frameIndex: number,
): string {
  return `phaser-asteroid-${tier}-${variant}-frame-${frameIndex}`;
}

function getAsteroidSurfaceVariant(visualVariant: number): AsteroidSurfaceVariant {
  const index =
    ((Math.trunc(visualVariant) % ASTEROID_SURFACE_VARIANTS.length) +
      ASTEROID_SURFACE_VARIANTS.length) %
    ASTEROID_SURFACE_VARIANTS.length;
  return ASTEROID_SURFACE_VARIANTS[index];
}

function getAsteroidTextureFrameIndex(tier: AsteroidTier, rotation: number): number {
  const frame = getAsteroidTextureFrame(tier, rotation);
  const frameCount = TIER_ROTATION_FRAME_COUNTS[tier];
  return Math.round(frame.progress) === 1 ? (frame.index + 1) % frameCount : frame.index;
}

function getAsteroidTextureFrame(
  tier: AsteroidTier,
  rotation: number,
): { index: number; progress: number } {
  const normalized = normalizeRotation(rotation);
  const frameCount = TIER_ROTATION_FRAME_COUNTS[tier];
  const frame = (normalized / FULL_ROTATION) * frameCount;
  const index = Math.floor(frame) % frameCount;
  return { index, progress: frame - Math.floor(frame) };
}

function getFrameAngle(frameIndex: number, frameCount: number): number {
  return (frameIndex / frameCount) * FULL_ROTATION;
}

function normalizeRotation(rotation: number): number {
  return ((rotation % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function getAsteroidTextureSize(tier: AsteroidTier): number {
  return getAsteroidTextureDisplaySize(tier) + ASTEROID_TEXTURE_PADDING * 2;
}

function getTierDetailScale(tier: AsteroidTier): number {
  if (tier === 'mega') return 1.08;
  if (tier === 'big') return 1;
  if (tier === 'medium') return 0.9;
  return 0.78;
}

function seededAngle(value: string): number {
  return hashFloat(hashString(value), 1, 1) * Math.PI * 2;
}

function shaderSeed(value: string): number {
  return hashFloat(hashString(value), 3, 7) * 1000;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  return hash;
}

function hashFloat(seed: number, x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function mixHexColor(left: string, right: string, amount: number): string {
  const from = parseHex(left);
  const to = parseHex(right);
  const clamped = Math.min(1, Math.max(0, amount));
  const mix = (key: keyof typeof from) => Math.round(from[key] + (to[key] - from[key]) * clamped);
  return `#${toHexChannel(mix('r'))}${toHexChannel(mix('g'))}${toHexChannel(mix('b'))}`;
}

function parseHex(value: string): { b: number; g: number; r: number } {
  return {
    b: Number.parseInt(value.slice(5, 7), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    r: Number.parseInt(value.slice(1, 3), 16),
  };
}

function toHexChannel(value: number): string {
  return value.toString(16).padStart(2, '0');
}
