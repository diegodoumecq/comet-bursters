import Phaser from 'phaser';

import { createCanvasTexture } from '../../core/canvasTextures';

export const PROCEDURAL_GALAXY_TEXTURE_KEY = 'math-galaxy:procedural-texture';

const GALAXY_SEED = 93817;
const STAR_SEED = 1729;
const PI = Math.PI;

type Color = readonly [number, number, number];

const SPACE_COLOR: Color = [2, 3, 12];
const HALO_COLOR: Color = [46, 62, 108];
const ARM_COLOR: Color = [94, 146, 207];
const CORE_COLOR: Color = [255, 221, 150];
const HOT_STAR_COLOR: Color = [172, 218, 255];
const NEBULA_COLOR: Color = [255, 86, 132];
const DUST_COLOR: Color = [7, 6, 11];

export function createProceduralGalaxyTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
): Phaser.Textures.CanvasTexture {
  return createCanvasTexture(scene, key, size, size, (context) => {
    const imageData = context.createImageData(size, size);
    renderGalaxy(imageData, size);
    context.putImageData(imageData, 0, 0);
  });
}

function renderGalaxy(imageData: ImageData, size: number): void {
  const data = imageData.data;
  const invSize = 1 / size;
  let index = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const uvx = (x + 0.5) * invSize;
      const uvy = (y + 0.5) * invSize;
      const centeredX = uvx * 2 - 1;
      const centeredY = uvy * 2 - 1;
      const sample = sampleGalaxy(centeredX, centeredY, uvx, uvy);

      data[index] = toByte(sample[0]);
      data[index + 1] = toByte(sample[1]);
      data[index + 2] = toByte(sample[2]);
      data[index + 3] = 255;
      index += 4;
    }
  }
}

function sampleGalaxy(centeredX: number, centeredY: number, uvx: number, uvy: number): Color {
  const rotated = rotate(centeredX, centeredY, -0.18);
  const diskX = rotated.x / 0.96;
  const diskY = rotated.y / 0.54;
  const baseRadius = Math.hypot(diskX, diskY);
  const haloMask = 1 - smoothstep(0.5, 1.25, baseRadius);
  const warpStrength = 0.09 * haloMask;
  const warpX =
    (fbm(diskX * 1.6 + 12.4, diskY * 1.6 - 2.8, GALAXY_SEED, 5) - 0.5) * warpStrength;
  const warpY =
    (fbm(diskX * 1.7 - 7.1, diskY * 1.7 + 9.8, GALAXY_SEED + 41, 5) - 0.5) * warpStrength;
  const cloudX = diskX + warpX;
  const cloudY = diskY + warpY;
  const radius = Math.hypot(cloudX, cloudY);
  const angle = Math.atan2(cloudY, cloudX);
  const logRadius = Math.log(Math.max(radius, 0.035));
  const diskMask = 1 - smoothstep(0.8, 1.08, radius);
  const innerWindow = smoothstep(0.06, 0.15, radius);
  const armWindow = innerWindow * diskMask;
  const broadNoise = fbm(cloudX * 2.2, cloudY * 2.2, GALAXY_SEED + 97, 5);
  const mediumNoise = fbm(cloudX * 5.4 + 11.3, cloudY * 5.4 - 3.7, GALAXY_SEED + 131, 5);
  const fineNoise = fbm(cloudX * 13.0 - 1.7, cloudY * 13.0 + 6.2, GALAXY_SEED + 173, 4);
  const ridgeNoise = ridgedFbm(
    cloudX * 8.4 + logRadius * 0.3,
    cloudY * 8.4 + angle * 0.05,
    GALAXY_SEED + 211,
    5,
  );
  const spiral = angle - logRadius * 1.86 + (broadNoise - 0.5) * 0.34 + (mediumNoise - 0.5) * 0.16;
  const armWidth = mix(0.36, 0.14, smoothstep(0.12, 0.88, radius));
  const armA = gaussianAngle(spiral, 0.2, armWidth);
  const armB = gaussianAngle(spiral, PI + 0.44, armWidth * 1.08);
  const branchA = gaussianAngle(spiral, 1.0, armWidth * 0.58) * smoothstep(0.34, 0.58, radius);
  const branchB = gaussianAngle(spiral, PI - 0.78, armWidth * 0.66) * smoothstep(0.42, 0.7, radius);
  const armShape = Math.max(armA, armB, branchA * 0.72, branchB * 0.68) * armWindow;
  const brokenArms =
    armShape *
    smoothstep(0.28, 0.92, broadNoise * 0.32 + mediumNoise * 0.45 + fineNoise * 0.28) *
    (0.72 + ridgeNoise * 0.42);
  const dustCoordinate = spiral + 0.22 + (mediumNoise - 0.5) * 0.18;
  const dustShape =
    Math.max(
      gaussianAngle(dustCoordinate, 0.42, armWidth * 0.44),
      gaussianAngle(dustCoordinate, PI + 0.66, armWidth * 0.48),
    ) * armWindow;
  const dustLanes =
    dustShape *
    smoothstep(0.38, 0.88, ridgeNoise * 0.72 + fineNoise * 0.28) *
    (0.42 + mediumNoise * 0.58);
  const core = Math.exp(-((cloudX * cloudX) / 0.014 + (cloudY * cloudY) / 0.008));
  const coreHaze = Math.exp(-radius * 4.5) * (0.62 + broadNoise * 0.22);
  const diffuseDisk = diskMask * Math.exp(-radius * 1.6) * (0.08 + broadNoise * 0.08);
  const nebula = brokenArms * smoothstep(0.56, 0.9, fineNoise) * smoothstep(0.12, 0.78, radius);
  const brightStars = starLayer(uvx, uvy, 560, 0.996, 0.032);
  const tinyStars = starLayer(uvx + 0.19, uvy - 0.11, 980, 0.992, 0.022);
  const galaxyStars =
    stellarGrain(cloudX, cloudY, 180, 0.94, 0.08) *
    (brokenArms * 1.28 + diffuseDisk * 0.78 + coreHaze * 0.35);
  const haloStars = stellarGrain(uvx - 0.17, uvy + 0.24, 130, 0.965, 0.055) * haloMask * 0.28;
  const backgroundNoise = fbm(uvx * 6.0, uvy * 6.0, GALAXY_SEED + 313, 3);

  let red = SPACE_COLOR[0] + backgroundNoise * 2.6;
  let green = SPACE_COLOR[1] + backgroundNoise * 2.8;
  let blue = SPACE_COLOR[2] + backgroundNoise * 5.4;

  const halo = coreHaze * 0.55 + diffuseDisk + brokenArms * 0.22;
  red += HALO_COLOR[0] * halo;
  green += HALO_COLOR[1] * halo;
  blue += HALO_COLOR[2] * halo;

  const arms = brokenArms * (0.74 + fineNoise * 0.36);
  red += ARM_COLOR[0] * arms;
  green += ARM_COLOR[1] * arms;
  blue += ARM_COLOR[2] * arms;

  red += NEBULA_COLOR[0] * nebula * 0.5;
  green += NEBULA_COLOR[1] * nebula * 0.24;
  blue += NEBULA_COLOR[2] * nebula * 0.36;

  const coreLight = core * 1.7 + coreHaze * 0.56;
  red += CORE_COLOR[0] * coreLight;
  green += CORE_COLOR[1] * coreLight;
  blue += CORE_COLOR[2] * coreLight;

  const starLight = brightStars * 1.4 + tinyStars * 0.86 + galaxyStars + haloStars;
  red += HOT_STAR_COLOR[0] * starLight;
  green += HOT_STAR_COLOR[1] * starLight;
  blue += HOT_STAR_COLOR[2] * starLight;

  const dustAmount = clamp(dustLanes * 0.7 + ridgeNoise * armShape * 0.16, 0, 0.82);
  red = mix(red, DUST_COLOR[0], dustAmount);
  green = mix(green, DUST_COLOR[1], dustAmount);
  blue = mix(blue, DUST_COLOR[2], dustAmount);

  const vignette = 1 - smoothstep(0.78, 1.4, Math.hypot(centeredX, centeredY));
  const exposure = 1.08 + core * 0.34;
  return [
    toneMap(red * exposure * (0.78 + vignette * 0.22)),
    toneMap(green * exposure * (0.78 + vignette * 0.22)),
    toneMap(blue * exposure * (0.82 + vignette * 0.18)),
  ];
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fade(fx);
  const uy = fade(fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.52;
  let frequency = 1;
  let totalAmplitude = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise(x * frequency, y * frequency, seed + octave * 19) * amplitude;
    totalAmplitude += amplitude;
    const nextX = x * 0.82 - y * 0.42;
    const nextY = x * 0.38 + y * 0.91;
    x = nextX + 4.7;
    y = nextY - 2.1;
    frequency *= 2.03;
    amplitude *= 0.53;
  }

  return value / totalAmplitude;
}

function ridgedFbm(x: number, y: number, seed: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.58;
  let totalAmplitude = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    const noise = valueNoise(x, y, seed + octave * 23);
    const ridge = 1 - Math.abs(noise * 2 - 1);
    value += ridge * ridge * amplitude;
    totalAmplitude += amplitude;
    const nextX = x * 1.47 - y * 0.39 + 3.8;
    const nextY = x * 0.32 + y * 1.53 - 6.4;
    x = nextX;
    y = nextY;
    amplitude *= 0.55;
  }

  return value / totalAmplitude;
}

function starLayer(uvx: number, uvy: number, scale: number, threshold: number, radius: number): number {
  const cellX = Math.floor(uvx * scale);
  const cellY = Math.floor(uvy * scale);
  const chance = hash(cellX, cellY, STAR_SEED);
  const jitterX = hash(cellX + 17, cellY - 9, STAR_SEED) - 0.5;
  const jitterY = hash(cellX - 3, cellY + 29, STAR_SEED) - 0.5;
  const localX = uvx * scale - cellX - 0.5 - jitterX * 0.5;
  const localY = uvy * scale - cellY - 0.5 - jitterY * 0.5;
  const core = 1 - smoothstep(radius * 0.16, radius, Math.hypot(localX, localY));
  return core * smoothstep(threshold, 1, chance);
}

function stellarGrain(
  x: number,
  y: number,
  scale: number,
  threshold: number,
  radius: number,
): number {
  const cellX = Math.floor((x + 1.4) * scale);
  const cellY = Math.floor((y + 1.4) * scale);
  const chance = hash(cellX, cellY, STAR_SEED + 113);
  const jitterX = hash(cellX + 37, cellY + 4, STAR_SEED + 113) - 0.5;
  const jitterY = hash(cellX - 8, cellY + 41, STAR_SEED + 113) - 0.5;
  const localX = (x + 1.4) * scale - cellX - 0.5 - jitterX * 0.62;
  const localY = (y + 1.4) * scale - cellY - 0.5 - jitterY * 0.62;
  const core = 1 - smoothstep(radius * 0.12, radius, Math.hypot(localX, localY));
  return core * smoothstep(threshold, 1, chance);
}

function hash(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function rotate(x: number, y: number, angle: number): { x: number; y: number } {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function gaussianAngle(a: number, b: number, width: number): number {
  const distance = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  return Math.exp(-(distance * distance) / Math.max(width * width, 0.0001));
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function toneMap(value: number): number {
  const mapped = 1 - Math.exp(-Math.max(0, value) / 255);
  return mapped * 255;
}

function toByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
