import Phaser from 'phaser';

import {
  createShaderTextures,
  hexToVec3Uniform,
  setFloatUniform,
  setVec2Uniform,
  setVec3Uniform,
} from '../core/shaderTextures';
import type { ShaderTextureInput } from '../core/shaderTextures';
import { ASTEROIDS } from './config';
import type { AsteroidTier } from './types';

const ASTEROID_SURFACE_VARIANTS = [
  'fbm-rugged',
  'granite-grain',
  'layered-planes',
  'fractured-basalt',
  'striated-shale',
  'breccia-mosaic',
  'regolith-dust',
  'iron-veined',
  'quartz-seamed',
  'eroded-ridges',
  'slag-scarred',
  'cold-carbon',
] as const;

type AsteroidSurfaceVariant = (typeof ASTEROID_SURFACE_VARIANTS)[number];

type SurfaceStyle =
  | 'basalt'
  | 'breccia'
  | 'carbon'
  | 'eroded'
  | 'granite'
  | 'iron'
  | 'planes'
  | 'quartz'
  | 'regolith'
  | 'rugged'
  | 'shale'
  | 'slag';

type SurfaceRecipe = {
  cell: number;
  contrast: number;
  dust: number;
  grainScale: number;
  key: AsteroidSurfaceVariant;
  metal?: string;
  ridge: number;
  style: SurfaceStyle;
  tint: string;
  tintAmount: number;
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

const SURFACE_RECIPES: readonly SurfaceRecipe[] = [
  {
    cell: 0.16,
    contrast: 0.64,
    dust: 0.06,
    grainScale: 3.2,
    key: 'fbm-rugged',
    ridge: 0.58,
    style: 'rugged',
    tint: '#8a8177',
    tintAmount: 0.66,
  },
  {
    cell: 0.34,
    contrast: 0.6,
    dust: 0.05,
    grainScale: 4.5,
    key: 'granite-grain',
    ridge: 0.48,
    style: 'granite',
    tint: '#716a61',
    tintAmount: 0.7,
  },
  {
    cell: 0.12,
    contrast: 0.68,
    dust: 0.05,
    grainScale: 2.8,
    key: 'layered-planes',
    ridge: 0.62,
    style: 'planes',
    tint: '#85766d',
    tintAmount: 0.68,
  },
  {
    cell: 0.1,
    contrast: 0.72,
    dust: 0.03,
    grainScale: 5.8,
    key: 'fractured-basalt',
    ridge: 0.88,
    style: 'basalt',
    tint: '#3f454b',
    tintAmount: 0.8,
  },
  {
    cell: 0.08,
    contrast: 0.62,
    dust: 0.05,
    grainScale: 3.6,
    key: 'striated-shale',
    ridge: 0.9,
    style: 'shale',
    tint: '#6c6870',
    tintAmount: 0.72,
  },
  {
    cell: 0.38,
    contrast: 0.66,
    dust: 0.07,
    grainScale: 4.1,
    key: 'breccia-mosaic',
    ridge: 0.58,
    style: 'breccia',
    tint: '#8a7f6f',
    tintAmount: 0.68,
  },
  {
    cell: 0.1,
    contrast: 0.48,
    dust: 0.38,
    grainScale: 6.5,
    key: 'regolith-dust',
    ridge: 0.34,
    style: 'regolith',
    tint: '#aaa092',
    tintAmount: 0.74,
  },
  {
    cell: 0.08,
    contrast: 0.64,
    dust: 0.04,
    grainScale: 4.8,
    key: 'iron-veined',
    metal: '#ff9b4d',
    ridge: 0.66,
    style: 'iron',
    tint: '#5b4540',
    tintAmount: 0.76,
  },
  {
    cell: 0.1,
    contrast: 0.62,
    dust: 0.04,
    grainScale: 4.6,
    key: 'quartz-seamed',
    metal: '#d7f4ff',
    ridge: 0.64,
    style: 'quartz',
    tint: '#73808b',
    tintAmount: 0.72,
  },
  {
    cell: 0.08,
    contrast: 0.74,
    dust: 0.05,
    grainScale: 3.4,
    key: 'eroded-ridges',
    ridge: 1,
    style: 'eroded',
    tint: '#77705f',
    tintAmount: 0.72,
  },
  {
    cell: 0.18,
    contrast: 0.78,
    dust: 0.03,
    grainScale: 5.2,
    key: 'slag-scarred',
    metal: '#c16b45',
    ridge: 0.72,
    style: 'slag',
    tint: '#4c403a',
    tintAmount: 0.78,
  },
  {
    cell: 0.12,
    contrast: 0.66,
    dust: 0.08,
    grainScale: 4.4,
    key: 'cold-carbon',
    ridge: 0.7,
    style: 'carbon',
    tint: '#414853',
    tintAmount: 0.82,
  },
];

const SURFACE_STYLE_INDEX: Record<SurfaceStyle, number> = {
  basalt: 3,
  breccia: 5,
  carbon: 11,
  eroded: 9,
  granite: 1,
  iron: 7,
  planes: 2,
  quartz: 8,
  regolith: 6,
  rugged: 0,
  shale: 4,
  slag: 10,
};

const ASTEROID_TEXTURE_PADDING = 4;
const NO_METAL_COLOR = '#000000';

const fragmentShader = `
precision highp float;

uniform float u_cell;
uniform float u_contrast;
uniform float u_dust;
uniform float u_grain_scale;
uniform float u_has_metal;
uniform float u_radius;
uniform float u_ridge;
uniform float u_rotation;
uniform float u_seed;
uniform float u_style;
uniform vec2 u_texture_size;
uniform vec3 u_base_color;
uniform vec3 u_metal_color;

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

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 warp = mat2(0.82, -0.57, 0.57, 0.82);
  for (int octave = 0; octave < 3; octave++) {
    value += valueNoise(p) * amplitude;
    p = warp * p * 2.06 + vec2(7.1, 3.9);
    amplitude *= 0.52;
  }
  return value;
}

float ridgedFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 warp = mat2(0.64, -0.77, 0.77, 0.64);
  for (int octave = 0; octave < 3; octave++) {
    float ridge = 1.0 - abs(valueNoise(p) * 2.0 - 1.0);
    value += ridge * ridge * amplitude;
    p = warp * p * 2.17 + vec2(4.9, 8.1);
    amplitude *= 0.54;
  }
  return value;
}

vec3 cellularRock(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float nearest = 8.0;
  float secondNearest = 8.0;
  float nearestId = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = neighbor + hash22(cell + neighbor) * 0.72 + 0.14;
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

vec2 styleUv(vec2 uv) {
  float granite = styleMask(1.0);
  float planes = styleMask(2.0);
  float shale = styleMask(4.0);
  float regolith = styleMask(6.0);
  float quartz = styleMask(8.0);
  float eroded = styleMask(9.0);
  float carbon = styleMask(11.0);
  vec2 shaleUv = rotate2d(0.42) * vec2(uv.x * 0.82, uv.y * 1.28);
  vec2 erodedUv = rotate2d(-0.35) * vec2(uv.x * 1.24, uv.y * 0.86);
  vec2 planeUv = rotate2d(0.2) * vec2(uv.x * 1.12, uv.y * 0.95);
  vec2 quartzUv = rotate2d(-0.22) * vec2(uv.x * 0.94, uv.y * 1.16);
  vec2 roundUv = uv * (1.0 + regolith * 0.06 + granite * 0.03);
  vec2 styled = mix(uv, shaleUv, shale);
  styled = mix(styled, erodedUv, eroded);
  styled = mix(styled, planeUv, planes);
  styled = mix(styled, quartzUv, quartz);
  styled = mix(styled, roundUv, regolith + granite + carbon * 0.18);
  return styled;
}

float silhouetteRadius(vec2 uv) {
  float angle = atan(uv.y, uv.x);
  float rugged = styleMask(0.0);
  float granite = styleMask(1.0);
  float planes = styleMask(2.0);
  float basalt = styleMask(3.0);
  float shale = styleMask(4.0);
  float breccia = styleMask(5.0);
  float regolith = styleMask(6.0);
  float quartz = styleMask(8.0);
  float eroded = styleMask(9.0);
  float slag = styleMask(10.0);
  float carbon = styleMask(11.0);
  float hardRock = rugged + basalt + breccia + slag + carbon;
  float softRock = granite + regolith + shale * 0.35 + eroded * 0.28;
  float angular = floor((angle + 3.14159) / 6.28318 * (7.0 + basalt * 2.0 + planes * 1.0)) / (7.0 + basalt * 2.0 + planes * 1.0);
  float block = (angularNoise(angular * 6.28318, 3.2, 31.7) - 0.5) * (basalt * 0.16 + planes * 0.1);
  float crystal = pow(abs(sin(angle * 5.0 + u_seed * 0.017)), 4.0) * quartz * 0.13;
  float lobe =
    (angularNoise(angle, 1.3, 2.1) - 0.5) * (0.28 + hardRock * 0.12 - softRock * 0.12) +
    (angularNoise(angle, 3.9, 8.4) - 0.5) * (0.14 + hardRock * 0.08 - softRock * 0.06) +
    floor(angularNoise(angle, 10.0, 14.8) * 5.0) * (0.018 + hardRock * 0.014);
  float chipNoise = angularNoise(angle, 7.2, 21.3);
  float chip = smoothstep(0.68, 0.98, chipNoise) * angularNoise(angle, 13.0, 5.7) * (0.09 + hardRock * 0.11 - softRock * 0.04);
  float dustyRoundness = regolith * 0.14 + granite * 0.05;
  return clamp(0.9 + lobe + block + crystal - chip + dustyRoundness, 0.66, 1.2);
}

float crackMask(vec2 uv, vec3 cells, float ridge) {
  float basalt = styleMask(3.0);
  float breccia = styleMask(5.0);
  float shale = styleMask(4.0);
  float regolith = styleMask(6.0);
  float iron = styleMask(7.0);
  float quartz = styleMask(8.0);
  float slag = styleMask(10.0);
  float cellCrack = 1.0 - smoothstep(0.018, 0.09 + u_cell * 0.07, cells.y);
  float sparseCellCrack = pow(cellCrack, 3.0) * smoothstep(0.54, 0.92, valueNoise(uv * 5.7 + u_seed));
  float ridgeCrack = smoothstep(0.76, 1.0, ridge) * smoothstep(0.42, 0.9, fbm(uv * 4.8 - u_seed));
  float layerCrack = smoothstep(0.88, 0.995, abs(sin((uv.y + fbm(uv * 1.8) * 0.18) * 18.0)));
  float seamCrack = smoothstep(0.82, 1.0, ridge) * smoothstep(0.54, 0.94, fbm(uv * 2.4 + vec2(3.7, -1.9)));
  float styleStrength =
    0.7 +
    basalt * 0.38 +
    breccia * 0.5 +
    shale * 0.34 -
    regolith * 0.48 +
    iron * 0.24 +
    quartz * 0.22 +
    slag * 0.36;
  return clamp(
    sparseCellCrack * (0.12 + breccia * 0.58 + basalt * 0.18) +
      ridgeCrack * styleStrength +
      layerCrack * shale * 0.42 +
      seamCrack * (iron + quartz) * 0.64,
    0.0,
    1.0
  );
}

float craterMask(vec2 uv, float scale, float threshold) {
  vec3 cells = cellularRock(uv * scale + u_seed * 0.031);
  float pit = 1.0 - smoothstep(0.08, 0.28, cells.x);
  float gate = smoothstep(threshold, 1.0, cells.z);
  return pit * gate;
}

float rockRelief(vec2 uv) {
  float rugged = styleMask(0.0);
  float granite = styleMask(1.0);
  float planes = styleMask(2.0);
  float basalt = styleMask(3.0);
  float shale = styleMask(4.0);
  float breccia = styleMask(5.0);
  float regolith = styleMask(6.0);
  float iron = styleMask(7.0);
  float quartz = styleMask(8.0);
  float eroded = styleMask(9.0);
  float slag = styleMask(10.0);
  float carbon = styleMask(11.0);
  float fractureStyle = rugged + planes * 0.75 + basalt + breccia + slag * 0.8 + carbon * 0.7;
  vec2 warped = uv + vec2(
    fbm(uv * 1.7 + 11.1) - 0.5,
    fbm(uv * 1.9 - 7.4) - 0.5
  ) * (0.08 + fractureStyle * 0.1 - regolith * 0.04);
  float cellScale = 2.25 + u_cell * 4.2 + breccia * 1.8 + planes * 0.75 - regolith * 1.0;
  vec3 cells = cellularRock(warped * cellScale);
  float ridge = ridgedFbm(warped * (u_grain_scale * (0.45 + fractureStyle * 0.32) + 1.3 + fractureStyle * 0.9));
  float broad = fbm(warped * 1.15) - 0.5;
  float grain = fbm(warped * u_grain_scale * 2.2) - 0.5;
  float shaleBands = sin((warped.y + fbm(warped * 1.7) * 0.15) * 20.0) * 0.5 + 0.5;
  float erodedRidges = ridgedFbm(vec2(warped.x * 1.2 + warped.y * 0.35, warped.y * 5.2));
  float quartzShard = pow(abs(sin((warped.x * 1.3 - warped.y * 0.9 + fbm(warped * 2.0) * 0.35) * 8.0)), 10.0);
  float basaltBlock = floor(valueNoise(warped * 5.4 + cells.z * 8.0) * 5.0) / 5.0 - 0.35;
  float carbonSlab = floor(valueNoise(warped * 3.6 - cells.z * 5.0) * 4.0) / 4.0 - 0.38;
  float regolithMottle = fbm(warped * 7.5 + vec2(11.0, -3.0));
  float brecciaChunk = floor(cells.z * 5.0) / 5.0 - 0.38;
  float planeSteps = floor((cells.z - 0.5) * (5.0 + planes * 4.0 + breccia * 3.0)) / (5.0 + planes * 4.0 + breccia * 3.0);
  float crevice = crackMask(uv, cells, ridge);
  float pits = craterMask(warped, 4.2 + slag * 5.0 + regolith * 2.2, 0.62 - slag * 0.12);
  float relief =
    broad * (0.45 + rugged * 0.1 - regolith * 0.2) +
    planeSteps * (0.36 + planes * 0.42 + breccia * 0.18) +
    brecciaChunk * breccia * 0.62 +
    ridge * u_ridge * (0.26 + basalt * 0.28 + slag * 0.18 + carbon * 0.12) +
    grain * (0.06 + granite * 0.1 + regolith * 0.08) +
    (shaleBands - 0.5) * shale * 0.36 +
    (erodedRidges - 0.45) * eroded * 0.52 +
    (regolithMottle - 0.5) * regolith * 0.22 +
    quartzShard * quartz * 0.34 +
    basaltBlock * basalt * 0.48 +
    carbonSlab * carbon * 0.36 -
    crevice * (0.22 + fractureStyle * 0.26 + iron * 0.14 + quartz * 0.1) -
    pits * (0.42 + slag * 0.34 + regolith * 0.12);
  return relief;
}

vec3 rockNormal(vec2 uv) {
  float texel = 1.0 / u_radius;
  float left = rockRelief(uv - vec2(texel, 0.0));
  float right = rockRelief(uv + vec2(texel, 0.0));
  float down = rockRelief(uv - vec2(0.0, texel));
  float up = rockRelief(uv + vec2(0.0, texel));
  float regolith = styleMask(6.0);
  float granite = styleMask(1.0);
  float planes = styleMask(2.0);
  float basalt = styleMask(3.0);
  float breccia = styleMask(5.0);
  float strength = 1.2 + planes * 0.4 + basalt * 0.45 + breccia * 0.25 - regolith * 0.45 - granite * 0.18;
  return normalize(vec3((left - right) * strength, (down - up) * strength, 0.18));
}

vec3 shadeRock(vec2 uv, float radial, float alpha) {
  float rugged = styleMask(0.0);
  float granite = styleMask(1.0);
  float planes = styleMask(2.0);
  float basalt = styleMask(3.0);
  float shale = styleMask(4.0);
  float breccia = styleMask(5.0);
  float regolith = styleMask(6.0);
  float iron = styleMask(7.0);
  float quartz = styleMask(8.0);
  float eroded = styleMask(9.0);
  float slag = styleMask(10.0);
  float carbon = styleMask(11.0);
  float smoothStyle = granite + regolith * 1.15;
  float fractureStyle = rugged + planes * 0.75 + basalt + breccia + slag * 0.8 + carbon * 0.7;
  vec2 warped = uv + vec2(
    fbm(uv * 1.7 + 11.1) - 0.5,
    fbm(uv * 1.9 - 7.4) - 0.5
  ) * (0.08 + fractureStyle * 0.12 - smoothStyle * 0.035);
  float cellScale = 2.25 + u_cell * 4.2 + breccia * 1.8 + planes * 0.75 - regolith * 1.0;
  vec3 cells = cellularRock(warped * cellScale);
  float ridge = ridgedFbm(warped * (u_grain_scale * (0.45 + fractureStyle * 0.32) + 1.3 + fractureStyle * 0.9));
  float crack = crackMask(uv, cells, ridge);
  float reliefHeight = rockRelief(uv);
  float broad = fbm(warped * 1.25) - 0.5;
  float grainHeight = fbm(warped * u_grain_scale * 2.7) - 0.5;
  float shaleBands = sin((warped.y + fbm(warped * 1.7) * 0.15) * 20.0) * 0.5 + 0.5;
  float erodedRidges = ridgedFbm(vec2(warped.x * 1.2 + warped.y * 0.35, warped.y * 5.2));
  float graniteFlecks = smoothstep(0.66, 0.98, valueNoise(warped * 18.0 + cells.z * 4.0));
  float regolithMottle = fbm(warped * 7.5 + vec2(11.0, -3.0));
  float quartzShard = pow(abs(sin((warped.x * 1.3 - warped.y * 0.9 + fbm(warped * 2.0) * 0.35) * 8.0)), 10.0);
  float basaltBlock = floor(valueNoise(warped * 5.4 + cells.z * 8.0) * 5.0) / 5.0 - 0.35;
  float slagPore = smoothstep(0.72, 0.98, valueNoise(warped * 12.0 + u_seed * 0.23)) * smoothstep(0.45, 1.0, ridge);
  float carbonSlab = floor(valueNoise(warped * 3.6 - cells.z * 5.0) * 4.0) / 4.0 - 0.38;
  float brecciaChunk = floor(cells.z * 5.0) / 5.0 - 0.38;
  float planeSteps = floor((cells.z - 0.5) * (5.0 + planes * 4.0 + breccia * 3.0)) / (5.0 + planes * 4.0 + breccia * 3.0);
  float plane = planeSteps + brecciaChunk * breccia * 0.85;
  float painterlyHeight =
    broad * (0.45 + rugged * 0.16 - regolith * 0.18) +
    plane * (0.34 + u_cell * 0.25 + planes * 0.32 + breccia * 0.28) +
    grainHeight * (0.08 + granite * 0.12 + regolith * 0.14) +
    ridge * u_ridge * (0.24 + basalt * 0.2 + slag * 0.18 + carbon * 0.12) +
    (shaleBands - 0.5) * shale * 0.28 +
    (erodedRidges - 0.45) * eroded * 0.44 +
    (regolithMottle - 0.5) * regolith * 0.32 +
    quartzShard * quartz * 0.24 +
    basaltBlock * basalt * 0.42 +
    carbonSlab * carbon * 0.34 -
    slagPore * slag * 0.5 +
    crack * (0.18 + fractureStyle * 0.24 - smoothStyle * 0.08);
  float height = mix(painterlyHeight, reliefHeight, 0.72);
  float steppedHeight = floor((height + 0.7) * (5.0 + planes * 3.0 + breccia * 2.0)) / (5.0 + planes * 3.0 + breccia * 2.0);
  vec2 facetTilt = vec2(
    valueNoise(warped * 4.2 + cells.z * 9.1) - 0.5,
    valueNoise(warped * 4.6 - cells.z * 6.7) - 0.5
  );
  facetTilt += vec2(
    (shaleBands - 0.5) * shale * 1.25 + quartzShard * quartz * 0.5,
    (erodedRidges - 0.45) * eroded * 1.1 + (regolithMottle - 0.5) * regolith * 0.32
  );
  vec3 sampledNormal = rockNormal(uv);
  vec3 facetNormal = normalize(vec3(
    facetTilt * (0.42 + fractureStyle * 0.52 + u_contrast * 0.28 + planes * 0.32 + breccia * 0.22 - smoothStyle * 0.16) - uv * 0.18,
    0.8 - basalt * 0.08 - planes * 0.06 + smoothStyle * 0.12
  ));
  vec3 normal = normalize(mix(facetNormal, sampledNormal, 0.68));
  vec3 lightDirection = normalize(vec3(-0.5, -0.68, 0.74));
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float planarDiffuse = mix(diffuse, floor(diffuse * (4.0 + planes * 2.0 + breccia * 1.0)) / (4.0 + planes * 2.0 + breccia * 1.0), 0.45 + u_contrast * 0.25 + planes * 0.18);
  float light = 0.32 + planarDiffuse * 0.82;
  float shadow = smoothstep(0.52, 1.04, radial) * 0.55;
  float facet =
    plane * u_contrast * 0.72 +
    steppedHeight * u_contrast * 0.34 +
    broad * 0.2 +
    grainHeight * 0.16 +
    (ridge - 0.34) * u_ridge * 0.42 +
    (shaleBands - 0.5) * shale * 0.18 +
    (erodedRidges - 0.45) * eroded * 0.32 +
    (graniteFlecks - 0.35) * granite * 0.24 +
    basaltBlock * basalt * 0.42 +
    carbonSlab * carbon * 0.28 -
    slagPore * slag * 0.22;
  float craterShadow = craterMask(warped, 4.2 + slag * 5.0 + regolith * 2.2, 0.62 - slag * 0.12);
  float occlusion = crack * (0.36 + u_ridge * 0.18) + craterShadow * (0.24 + slag * 0.28) + shadow;
  float luma = dot(u_base_color, vec3(0.299, 0.587, 0.114));
  vec3 mineralBase = mix(u_base_color, vec3(luma), 0.34 + basalt * 0.12 + carbon * 0.16 + regolith * 0.1);
  vec3 color = mineralBase * (light + facet - occlusion);
  color = mix(color, color * vec3(1.08, 1.06, 1.0), graniteFlecks * granite * 0.3);
  color = mix(color, color * vec3(0.78, 0.84, 0.96), shaleBands * shale * 0.2);
  color = mix(color, color * vec3(0.52, 0.58, 0.64), basalt * 0.42);
  color = mix(color, color * vec3(0.45, 0.48, 0.54), carbon * 0.5);
  color = mix(color, u_base_color * (0.8 + brecciaChunk), breccia * 0.28);
  color = mix(color, u_base_color * (0.7 + regolithMottle * 0.42), regolith * 0.62);
  color = mix(color, vec3(0.85, 0.95, 1.0), quartzShard * quartz * 0.36);
  float pits = smoothstep(0.66, 0.98, ridge) * smoothstep(0.5, 0.92, valueNoise(warped * (8.0 + slag * 4.0) + u_seed));
  color = mix(color, vec3(0.025, 0.024, 0.027), pits * (0.12 + u_ridge * 0.12 + basalt * 0.12 + slag * 0.28 + carbon * 0.18));
  float seam = smoothstep(0.72, 1.0, crack) * smoothstep(0.5, 1.0, ridge);
  float ironSeam = smoothstep(0.74, 0.99, ridgedFbm(warped * 3.2 + vec2(4.1, -2.7)));
  float vein = seam * u_has_metal * (0.7 + iron * 0.35 + quartz * 0.3);
  color = mix(color, u_metal_color * (0.72 + diffuse * 0.7), vein * 0.32 + ironSeam * iron * 0.24);
  color = mix(color, vec3(0.015, 0.012, 0.012), slagPore * slag * 0.62);
  float grain = hash12(gl_FragCoord.xy + u_seed) - 0.5;
  color += grain * (0.05 + u_dust * 0.1 + granite * 0.04 + regolith * 0.08);
  float dust = smoothstep(1.0 - u_dust * 0.18, 1.0, hash12(gl_FragCoord.xy * 0.73 - u_seed));
  color = mix(color, vec3(0.95, 0.89, 0.78), dust * u_dust * (0.24 + regolith * 0.44));
  float edgeWear = smoothstep(0.78, 1.0, radial) * smoothstep(0.2, 1.0, dot(normal, lightDirection));
  color = mix(color, vec3(1.0, 0.94, 0.82), edgeWear * (0.08 + planes * 0.06 + slag * 0.05) * alpha);
  return clamp(color, vec3(0.0), vec3(1.0));
}

void main() {
  vec2 centered = (gl_FragCoord.xy - u_texture_size * 0.5) / u_radius;
  vec2 uv = styleUv(rotate2d(u_rotation) * centered);
  float radial = length(uv);
  float edge = silhouetteRadius(uv);
  float alpha = smoothstep(edge + 0.018, edge - 0.008, radial);
  if (alpha <= 0.001) {
    gl_FragColor = vec4(0.0);
  } else {
    vec3 color = shadeRock(uv / max(edge, 0.001), radial / max(edge, 0.001), alpha);
    gl_FragColor = vec4(color, alpha);
  }
}
`;

export function createAsteroidTextures(scene: Phaser.Scene): void {
  const inputs: ShaderTextureInput[] = [];
  for (const tier of Object.keys(ASTEROIDS) as AsteroidTier[]) {
    ASTEROID_TEXTURES[tier].forEach((key, index) => {
      if (scene.textures.exists(key)) return;
      const textureSize = getAsteroidTextureSize(tier);
      inputs.push(createAsteroidShaderTextureInput(
        key,
        textureSize,
        ASTEROIDS[tier].radius,
        tier,
        SURFACE_RECIPES[index],
      ));
    });
  }
  if (inputs.length > 0 && !createShaderTextures(scene, fragmentShader, inputs))
    throw new Error('Unable to create asteroid shader textures');
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
): ShaderTextureInput {
  const baseColor = mixHexColor(TIER_BASE_COLORS[tier], recipe.tint, recipe.tintAmount);
  return {
    setUniforms: (gl, program) => {
      setFloatUniform(gl, program, 'u_cell', recipe.cell);
      setFloatUniform(gl, program, 'u_contrast', recipe.contrast);
      setFloatUniform(gl, program, 'u_dust', recipe.dust);
      setFloatUniform(gl, program, 'u_grain_scale', recipe.grainScale);
      setFloatUniform(gl, program, 'u_has_metal', recipe.metal ? 1 : 0);
      setFloatUniform(gl, program, 'u_radius', radius);
      setFloatUniform(gl, program, 'u_ridge', recipe.ridge);
      setFloatUniform(gl, program, 'u_rotation', seededAngle(`${tier}:${recipe.key}:rotation`));
      setFloatUniform(gl, program, 'u_seed', shaderSeed(`${tier}:${recipe.key}`));
      setFloatUniform(gl, program, 'u_style', SURFACE_STYLE_INDEX[recipe.style]);
      setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
      setVec3Uniform(gl, program, 'u_base_color', hexToVec3Uniform(baseColor));
      setVec3Uniform(
        gl,
        program,
        'u_metal_color',
        hexToVec3Uniform(recipe.metal ?? NO_METAL_COLOR),
      );
    },
    textureKey,
    textureSize,
  };
}

function createTextureKeys(tier: AsteroidTier): readonly string[] {
  return ASTEROID_SURFACE_VARIANTS.map((variant) => `phaser-asteroid-${tier}-${variant}`);
}

function getAsteroidTextureSize(tier: AsteroidTier): number {
  return getAsteroidTextureDisplaySize(tier) + ASTEROID_TEXTURE_PADDING * 2;
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
