import Phaser from 'phaser';

import {
  createShaderTexture,
  hexToVec3Uniform,
  setFloatUniform,
  setVec2Uniform,
  setVec3Uniform,
} from '../../core/shaderTextures';

export const SPIRAL_GALAXY_TEXTURE_KEY = 'spiral-galaxy:generated-texture';

const fragmentShader = `
precision highp float;

uniform float u_display_aspect;
uniform float u_seed;
uniform vec2 u_texture_size;
uniform vec3 u_core_color;
uniform vec3 u_arm_color;
uniform vec3 u_dust_color;
uniform vec3 u_cluster_color;
uniform vec3 u_space_color;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.52;
  for (int i = 0; i < 6; i++) {
    value += valueNoise(p) * amplitude;
    p = mat3(
      0.76, -0.50, 0.41,
      0.58, 0.80, -0.16,
      -0.29, 0.36, 0.89
    ) * p * 2.04 + vec3(5.7, 2.8, 8.3);
    amplitude *= 0.52;
  }
  return value;
}

float ridgedFbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.58;
  for (int i = 0; i < 5; i++) {
    float ridge = 1.0 - abs(valueNoise(p) * 2.0 - 1.0);
    value += ridge * ridge * amplitude;
    p = mat3(
      0.66, -0.57, 0.49,
      0.64, 0.77, 0.04,
      -0.39, 0.29, 0.87
    ) * p * 2.22 + vec3(3.7, 8.8, 1.9);
    amplitude *= 0.54;
  }
  return value;
}

float billowFbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.56;
  for (int i = 0; i < 6; i++) {
    float billow = abs(valueNoise(p) * 2.0 - 1.0);
    value += (1.0 - billow * billow) * amplitude;
    p = mat3(
      0.49, -0.78, 0.39,
      0.86, 0.43, -0.27,
      0.04, 0.46, 0.89
    ) * p * 1.86 + vec3(4.3, 7.6, 2.1);
    amplitude *= 0.53;
  }
  return value;
}

vec2 curlWarp(vec3 p) {
  float left = valueNoise(p + vec3(-0.29, 0.0, 0.0));
  float right = valueNoise(p + vec3(0.29, 0.0, 0.0));
  float down = valueNoise(p + vec3(0.0, -0.29, 0.0));
  float up = valueNoise(p + vec3(0.0, 0.29, 0.0));
  vec2 broad = vec2(up - down, left - right);
  vec2 detail = vec2(
    valueNoise(p * 2.1 + vec3(4.1, 8.7, 2.3)) - 0.5,
    valueNoise(p * 2.3 + vec3(7.6, 1.9, 6.4)) - 0.5
  );
  return broad + detail * 0.34;
}

float starLayer(vec2 uv, float scale, float threshold, float sparkle) {
  vec2 cell = floor(uv * scale);
  vec2 local = fract(uv * scale) - 0.5;
  float star = hash21(cell + vec2(u_seed * 0.017, u_seed * 0.031));
  float radius = mix(0.015, 0.09, hash21(cell + vec2(9.1, 2.7)));
  float core = 1.0 - smoothstep(0.0, radius, length(local));
  return core * smoothstep(threshold, 1.0, star) * sparkle;
}

float knotLayer(vec2 p, float scale, float threshold, float minRadius, float maxRadius) {
  vec2 cell = floor(p * scale);
  vec2 local = fract(p * scale) - 0.5;
  float chance = hash21(cell + vec2(u_seed * 0.041, u_seed * 0.053));
  vec2 jitter =
    vec2(
      hash21(cell + vec2(11.7, 2.3)),
      hash21(cell + vec2(4.9, 17.1))
    ) -
    0.5;
  float radius = mix(minRadius, maxRadius, hash21(cell + vec2(8.3, 21.4)));
  float knot = 1.0 - smoothstep(radius * 0.28, radius, length(local - jitter * 0.24));
  return knot * smoothstep(threshold, 1.0, chance);
}

float stellarGrain(vec2 p, float scale, float threshold) {
  vec2 cell = floor(p * scale);
  vec2 local = fract(p * scale) - 0.5;
  float chance = hash21(cell + vec2(u_seed * 0.067, u_seed * 0.079));
  vec2 jitter =
    vec2(
      hash21(cell + vec2(31.2, 6.7)),
      hash21(cell + vec2(12.4, 45.9))
    ) -
    0.5;
  float radius = mix(0.035, 0.12, hash21(cell + vec2(19.1, 3.4)));
  float star = 1.0 - smoothstep(radius * 0.2, radius, length(local - jitter * 0.38));
  return star * smoothstep(threshold, 1.0, chance);
}

float softCloud(vec2 p, float scale, float phase) {
  vec3 cloudPosition = vec3(p * scale, phase);
  float billows = billowFbm(cloudPosition);
  float folds = fbm(cloudPosition * 0.66 + vec3(4.7, 1.9, 8.2));
  float ridges = ridgedFbm(cloudPosition * 1.58 + vec3(2.3, 7.6, 4.1));
  return smoothstep(0.28, 0.92, billows * 0.58 + folds * 0.28 + ridges * 0.18);
}

float granularCloud(vec2 p, float scale, float phase) {
  vec3 cloudPosition = vec3(p * scale, phase);
  float broad = fbm(cloudPosition * 0.48 + vec3(7.0, 1.6, 4.5));
  float cells = billowFbm(cloudPosition + broad * 1.4);
  float lace = ridgedFbm(cloudPosition * 2.7 + vec3(3.4, 8.1, 2.2));
  return smoothstep(0.46, 0.86, cells * 0.52 + lace * 0.32 + broad * 0.18);
}

vec2 rotate2(vec2 p, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c) * p;
}

float angleDistance(float a, float b) {
  return abs(atan(sin(a - b), cos(a - b)));
}

float gaussian(float value, float width) {
  return exp(-(value * value) / max(width * width, 0.0001));
}

float radialWindow(float radius, float start, float end, float feather) {
  return smoothstep(start - feather, start + feather, radius) * (1.0 - smoothstep(end - feather, end + feather, radius));
}

float brokenSpiralStrand(
  float coordinate,
  float center,
  float width,
  float radius,
  float angle,
  float seedOffset
) {
  float wobble =
    (fbm(vec3(radius * 4.4 + seedOffset, angle * 1.35, u_seed * 0.151 + seedOffset)) - 0.5) *
    width *
    2.6;
  float strand = gaussian(angleDistance(coordinate + wobble, center), width);
  float beads = fbm(vec3(radius * 7.2 + seedOffset * 1.7, angle * 2.1, u_seed * 0.167 + seedOffset));
  float cuts = ridgedFbm(vec3(radius * 13.0 + seedOffset, angle * 3.4, u_seed * 0.181 + seedOffset));
  float segment = smoothstep(0.22, 0.84, beads) * (1.0 - smoothstep(0.86, 0.99, cuts) * 0.64);
  return strand * (0.18 + segment * 0.95);
}

float filamentPatch(
  float coordinate,
  float center,
  float width,
  float radius,
  float angle,
  float start,
  float end,
  float seedOffset
) {
  float patch = brokenSpiralStrand(coordinate, center, width, radius, angle, seedOffset);
  float radial = radialWindow(radius, start, end, 0.045);
  float localBreak =
    smoothstep(0.18, 0.82, fbm(vec3(radius * 11.0 + seedOffset, angle * 2.6, u_seed * 0.219 + seedOffset)));
  return patch * radial * (0.32 + localBreak * 0.86);
}

float cloudletField(vec2 p, float radius, float angle, float gate) {
  float coarse =
    knotLayer(p + vec2(0.21, -0.13), 7.0, 0.62, 0.12, 0.32) +
    knotLayer(p + vec2(-0.36, 0.28), 10.0, 0.7, 0.08, 0.24) +
    knotLayer(p + vec2(0.08, 0.41), 14.0, 0.78, 0.055, 0.17);
  float shredded = smoothstep(0.28, 0.88, billowFbm(vec3(p * 14.0 + vec2(angle * 0.08, radius * 0.6), u_seed * 0.241)));
  float radialBreak =
    smoothstep(0.16, 0.9, fbm(vec3(radius * 17.0, angle * 4.0, u_seed * 0.257))) *
    (1.0 - smoothstep(0.86, 0.99, ridgedFbm(vec3(radius * 23.0, angle * 5.0, u_seed * 0.269))) * 0.76);
  return coarse * shredded * radialBreak * smoothstep(0.16, 0.84, gate);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_texture_size.xy;
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= u_display_aspect;

  vec2 galaxySpace = rotate2(centered * 0.74, -0.11);
  vec2 disk = vec2(galaxySpace.x / 0.9, galaxySpace.y / 0.7);
  float diskRadius = length(disk);
  float diskMask = 1.0 - smoothstep(0.84, 1.06, diskRadius);
  float haloMask = 1.0 - smoothstep(0.42, 1.2, diskRadius);

  vec3 seedOffset = vec3(u_seed * 0.011, u_seed * 0.017, u_seed * 0.023);
  vec2 broadCurl = curlWarp(vec3(disk * 1.08, diskRadius * 1.2) + seedOffset) * 0.035 * haloMask;
  vec2 cloudDisk = disk + broadCurl;
  float cloudRadius = length(cloudDisk);
  float cloudAngle = atan(cloudDisk.y, cloudDisk.x);
  float logRadius = log(max(cloudRadius, 0.032));

  float broadCloud = softCloud(cloudDisk, 2.0, u_seed * 0.021);
  float mediumCloud = softCloud(cloudDisk + broadCurl * 2.4, 4.9, u_seed * 0.037);
  float clumpCloud = granularCloud(cloudDisk, 10.5, u_seed * 0.051);
  float starCloud = granularCloud(cloudDisk + vec2(0.17, -0.09), 22.0, u_seed * 0.071);
  float filamentCloud = ridgedFbm(vec3(cloudRadius * 8.0, cloudAngle * 1.45, u_seed * 0.061));
  float darkCloud = ridgedFbm(vec3(cloudDisk * 13.0 + vec2(logRadius * 0.35, cloudAngle * 0.06), u_seed * 0.089));
  float cloudIslands =
    smoothstep(0.36, 0.88, broadCloud * 0.3 + mediumCloud * 0.4 + clumpCloud * 0.26) *
    (0.72 + 0.28 * fbm(vec3(cloudDisk * 3.6, u_seed * 0.117)));
  float angularLopsidedness =
    0.72 + 0.42 * fbm(vec3(cos(cloudAngle) * 1.45, sin(cloudAngle) * 1.45, u_seed * 0.029));

  float spiralCoordinate =
    cloudAngle - logRadius * 1.58 + broadCloud * 0.17 + mediumCloud * 0.11 + filamentCloud * 0.028;
  float looseSpiralCoordinate =
    cloudAngle - logRadius * 1.12 + broadCloud * 0.24 - mediumCloud * 0.08 + filamentCloud * 0.05;
  float midSpiralCoordinate =
    cloudAngle - logRadius * 1.42 - broadCloud * 0.08 + mediumCloud * 0.2 + filamentCloud * 0.035;
  float openSpiralCoordinate =
    cloudAngle - logRadius * 0.82 + broadCloud * 0.16 + mediumCloud * 0.05 - filamentCloud * 0.02;
  float tightSpiralCoordinate =
    cloudAngle - logRadius * 2.06 + broadCloud * 0.08 + mediumCloud * 0.16 - filamentCloud * 0.04;
  float forkSpiralCoordinate =
    cloudAngle - logRadius * 1.58 + broadCloud * 0.22 - clumpCloud * 0.08 + filamentCloud * 0.05;
  float spurSpiralCoordinate =
    cloudAngle - logRadius * 1.08 - broadCloud * 0.08 + mediumCloud * 0.18 + filamentCloud * 0.04;
  float shardSpiralCoordinate =
    cloudAngle - logRadius * 1.78 + broadCloud * 0.06 - mediumCloud * 0.1 + clumpCloud * 0.08;
  float innerGate = smoothstep(0.1, 0.2, cloudRadius);
  float outerGate = 1.0 - smoothstep(0.88, 1.08, cloudRadius);
  float radialGate = innerGate * outerGate;
  float physicalArmWidth = mix(0.07, 0.126, smoothstep(0.16, 0.9, cloudRadius));
  float angularWidth = physicalArmWidth / max(cloudRadius, 0.16);
  float armA = gaussian(angleDistance(spiralCoordinate, 0.12), angularWidth);
  float armB = gaussian(angleDistance(spiralCoordinate, PI + 0.24), angularWidth * 1.08);
  float armAWeight = 0.88 + 0.28 * fbm(vec3(cloudRadius * 2.2, 0.7, u_seed * 0.133));
  float armBWeight = 0.78 + 0.36 * fbm(vec3(cloudRadius * 2.5, 5.9, u_seed * 0.149));
  float branchGate = smoothstep(0.38, 0.56, cloudRadius) * (1.0 - smoothstep(0.9, 1.08, cloudRadius));
  float branchA = gaussian(angleDistance(spiralCoordinate, 0.7), angularWidth * 0.78) * branchGate;
  float branchB = gaussian(angleDistance(spiralCoordinate, PI - 0.56), angularWidth * 0.86) * branchGate;
  float armScaffold = max(armA * armAWeight, armB * armBWeight);
  float branchScaffold = max(branchA, branchB);
  float brokenArmA =
    filamentPatch(spiralCoordinate, -0.1, angularWidth * 0.42, cloudRadius, cloudAngle, 0.18, 0.5, 1.7) +
    filamentPatch(spiralCoordinate, 0.15, angularWidth * 0.52, cloudRadius, cloudAngle, 0.34, 0.76, 5.1) +
    filamentPatch(spiralCoordinate, 0.39, angularWidth * 0.35, cloudRadius, cloudAngle, 0.58, 0.94, 8.4);
  float brokenArmB =
    filamentPatch(spiralCoordinate, PI + 0.02, angularWidth * 0.5, cloudRadius, cloudAngle, 0.16, 0.48, 2.9) +
    filamentPatch(spiralCoordinate, PI + 0.27, angularWidth * 0.42, cloudRadius, cloudAngle, 0.36, 0.72, 6.6) +
    filamentPatch(spiralCoordinate, PI + 0.53, angularWidth * 0.36, cloudRadius, cloudAngle, 0.62, 0.98, 10.2);
  float brokenBranches =
    filamentPatch(spiralCoordinate, 0.72, angularWidth * 0.36, cloudRadius, cloudAngle, 0.42, 0.84, 12.5) *
    branchGate +
    filamentPatch(spiralCoordinate, PI - 0.54, angularWidth * 0.4, cloudRadius, cloudAngle, 0.34, 0.78, 15.8) *
    branchGate;
  float looseFragments =
    (
      filamentPatch(looseSpiralCoordinate, 1.05, angularWidth * 0.5, cloudRadius, cloudAngle, 0.28, 0.62, 18.3) +
      filamentPatch(looseSpiralCoordinate, PI - 0.95, angularWidth * 0.42, cloudRadius, cloudAngle, 0.5, 0.9, 21.1) +
      filamentPatch(looseSpiralCoordinate, 2.4, angularWidth * 0.34, cloudRadius, cloudAngle, 0.22, 0.46, 24.7)
    ) *
    smoothstep(0.28, 0.72, cloudRadius) *
    (1.0 - smoothstep(0.94, 1.08, cloudRadius));
  float midFragments =
    (
      filamentPatch(midSpiralCoordinate, 0.72, angularWidth * 0.44, cloudRadius, cloudAngle, 0.24, 0.54, 32.8) +
      filamentPatch(midSpiralCoordinate, 2.05, angularWidth * 0.36, cloudRadius, cloudAngle, 0.38, 0.74, 35.3) +
      filamentPatch(midSpiralCoordinate, PI + 1.1, angularWidth * 0.42, cloudRadius, cloudAngle, 0.52, 0.92, 38.1)
    ) *
    smoothstep(0.22, 0.82, cloudRadius);
  float outerFragments =
    (
      filamentPatch(openSpiralCoordinate, -0.35, angularWidth * 0.5, cloudRadius, cloudAngle, 0.56, 0.98, 41.6) +
      filamentPatch(openSpiralCoordinate, 1.75, angularWidth * 0.45, cloudRadius, cloudAngle, 0.46, 0.86, 44.4) +
      filamentPatch(openSpiralCoordinate, PI + 0.7, angularWidth * 0.38, cloudRadius, cloudAngle, 0.64, 1.03, 47.2)
    ) *
    smoothstep(0.42, 0.9, cloudRadius);
  float fanFragments =
    (
      filamentPatch(openSpiralCoordinate, 0.48, angularWidth * 0.36, cloudRadius, cloudAngle, 0.26, 0.58, 49.4) +
      filamentPatch(openSpiralCoordinate, 1.22, angularWidth * 0.32, cloudRadius, cloudAngle, 0.34, 0.7, 51.9) +
      filamentPatch(openSpiralCoordinate, 2.58, angularWidth * 0.34, cloudRadius, cloudAngle, 0.4, 0.82, 54.6) +
      filamentPatch(openSpiralCoordinate, -1.72, angularWidth * 0.3, cloudRadius, cloudAngle, 0.48, 0.9, 57.3) +
      filamentPatch(midSpiralCoordinate, -0.98, angularWidth * 0.28, cloudRadius, cloudAngle, 0.18, 0.46, 60.1) +
      filamentPatch(midSpiralCoordinate, PI - 0.08, angularWidth * 0.3, cloudRadius, cloudAngle, 0.24, 0.62, 63.8)
    ) *
    smoothstep(0.18, 0.86, cloudRadius) *
    (1.0 - smoothstep(0.98, 1.08, cloudRadius));
  float featherFragments =
    (
      filamentPatch(tightSpiralCoordinate, 0.34, angularWidth * 0.24, cloudRadius, cloudAngle, 0.12, 0.36, 66.7) +
      filamentPatch(tightSpiralCoordinate, 1.48, angularWidth * 0.26, cloudRadius, cloudAngle, 0.2, 0.52, 69.2) +
      filamentPatch(tightSpiralCoordinate, -2.32, angularWidth * 0.25, cloudRadius, cloudAngle, 0.3, 0.68, 72.4) +
      filamentPatch(looseSpiralCoordinate, -0.22, angularWidth * 0.27, cloudRadius, cloudAngle, 0.46, 0.78, 75.5) +
      filamentPatch(looseSpiralCoordinate, 2.88, angularWidth * 0.24, cloudRadius, cloudAngle, 0.56, 0.94, 78.1)
    ) *
    smoothstep(0.12, 0.78, cloudRadius);
  float upperForkSector =
    gaussian(angleDistance(cloudAngle, 1.28), 0.92) *
    smoothstep(0.12, 0.48, cloudRadius) *
    (1.0 - smoothstep(0.7, 0.92, cloudRadius)) *
    smoothstep(-0.12, 0.18, cloudDisk.x);
  float lowerForkSector =
    gaussian(angleDistance(cloudAngle, -0.72), 0.78) *
    smoothstep(0.18, 0.54, cloudRadius) *
    (1.0 - smoothstep(0.82, 1.02, cloudRadius)) *
    smoothstep(0.02, 0.24, cloudDisk.x);
  float highWispSector =
    gaussian(angleDistance(cloudAngle, 2.05), 0.52) *
    smoothstep(0.34, 0.7, cloudRadius) *
    (1.0 - smoothstep(0.9, 1.06, cloudRadius));
  float rightSpurSector =
    gaussian(angleDistance(cloudAngle, -0.18), 0.68) *
    smoothstep(0.36, 0.68, cloudRadius) *
    (1.0 - smoothstep(0.96, 1.08, cloudRadius)) *
    smoothstep(0.08, 0.3, cloudDisk.x);
  float forkFragments =
    (
      filamentPatch(forkSpiralCoordinate, 0.92, angularWidth * 0.29, cloudRadius, cloudAngle, 0.18, 0.46, 82.3) +
      filamentPatch(forkSpiralCoordinate, 1.34, angularWidth * 0.24, cloudRadius, cloudAngle, 0.26, 0.58, 84.9)
    ) *
    upperForkSector +
    (
      filamentPatch(forkSpiralCoordinate, -0.46, angularWidth * 0.27, cloudRadius, cloudAngle, 0.24, 0.56, 87.1) +
      filamentPatch(shardSpiralCoordinate, -0.08, angularWidth * 0.21, cloudRadius, cloudAngle, 0.36, 0.72, 89.7)
    ) *
    lowerForkSector;
  float spurFragments =
    (
      filamentPatch(midSpiralCoordinate, 0.56, angularWidth * 0.3, cloudRadius, cloudAngle, 0.46, 0.82, 92.8) +
      filamentPatch(spiralCoordinate, 0.88, angularWidth * 0.22, cloudRadius, cloudAngle, 0.58, 0.96, 95.4)
    ) *
    rightSpurSector;
  float wispFragments =
    (
      filamentPatch(midSpiralCoordinate, 2.12, angularWidth * 0.34, cloudRadius, cloudAngle, 0.42, 0.78, 98.6) +
      filamentPatch(forkSpiralCoordinate, 2.48, angularWidth * 0.24, cloudRadius, cloudAngle, 0.54, 0.9, 101.5)
    ) *
    highWispSector *
    (0.42 + mediumCloud * 0.5 + broadCloud * 0.26);
  float leftOuterSecondaryDamping = mix(0.22, 1.0, smoothstep(-0.22, 0.18, cloudDisk.x));
  float leftOuterArmBlend = smoothstep(0.28, 0.58, cloudRadius);
  float leftNewArmDamping = mix(0.06, 1.0, smoothstep(-0.14, 0.2, cloudDisk.x));
  float leftFeatherDamping = mix(0.14, 1.0, smoothstep(-0.2, 0.16, cloudDisk.x));
  looseFragments *= mix(1.0, leftOuterSecondaryDamping, leftOuterArmBlend * 0.42);
  midFragments *= mix(1.0, leftOuterSecondaryDamping, leftOuterArmBlend * 0.5);
  outerFragments *= mix(1.0, leftOuterSecondaryDamping, leftOuterArmBlend * 0.68);
  fanFragments *= leftNewArmDamping;
  featherFragments *= leftFeatherDamping;
  float tightFragments =
    (
      filamentPatch(tightSpiralCoordinate, -0.52, angularWidth * 0.34, cloudRadius, cloudAngle, 0.16, 0.42, 27.2) +
      filamentPatch(tightSpiralCoordinate, PI + 0.86, angularWidth * 0.38, cloudRadius, cloudAngle, 0.28, 0.6, 30.5)
    ) *
    smoothstep(0.18, 0.58, cloudRadius) *
    (1.0 - smoothstep(0.76, 0.96, cloudRadius));
  float brokenArms =
    (
      brokenArmA * armAWeight * 0.58 +
      brokenArmB * armBWeight * 0.56 +
      brokenBranches * 0.62 +
      looseFragments * 0.78 +
      midFragments * 0.72 +
      outerFragments * 0.66 +
      fanFragments * 1.08 +
      featherFragments * 0.94 +
      forkFragments * 1.34 +
      spurFragments * 1.22 +
      wispFragments * 0.96 +
      tightFragments * 0.62
    ) *
    radialGate;
  float fragmentProbability =
    smoothstep(
      0.05,
      0.68,
      brokenArms +
        looseFragments * 0.5 +
        midFragments * 0.62 +
        outerFragments * 0.58 +
        fanFragments * 0.7 +
        featherFragments * 0.62 +
        forkFragments * 0.96 +
        spurFragments * 0.9 +
        wispFragments * 0.68 +
        tightFragments * 0.45 +
        branchScaffold * 0.24
    );
  float cloudlets =
    cloudletField(cloudDisk + broadCurl * 1.8, cloudRadius, cloudAngle, fragmentProbability) *
    radialGate *
    (1.0 - smoothstep(0.92, 1.08, cloudRadius));
  float looseCloudlets =
    cloudletField(
      cloudDisk + vec2(0.13, -0.21) + broadCurl * 2.4,
      cloudRadius,
      cloudAngle + 1.7,
      smoothstep(
        0.04,
        0.58,
        looseFragments +
          midFragments +
          outerFragments +
          fanFragments +
          featherFragments +
          forkFragments +
          spurFragments +
          wispFragments +
          tightFragments +
          branchScaffold * 0.2
      )
    ) *
    radialGate *
    smoothstep(0.22, 0.84, cloudRadius);
  float outerCloudlets =
    cloudletField(
      cloudDisk + vec2(-0.24, 0.18) + broadCurl * 3.0,
      cloudRadius,
      cloudAngle - 2.2,
      smoothstep(
        0.03,
        0.52,
        midFragments +
          outerFragments +
          fanFragments +
          featherFragments * 0.6 +
          forkFragments * 0.72 +
          spurFragments * 0.74 +
          wispFragments * 0.58 +
          looseFragments * 0.35
      )
    ) *
    radialGate *
    smoothstep(0.38, 0.94, cloudRadius);
  float differentArmCloudlets =
    cloudletField(
      cloudDisk + vec2(0.29, 0.07) + broadCurl * 2.8,
      cloudRadius,
      cloudAngle + 0.55,
      smoothstep(0.03, 0.46, forkFragments + spurFragments + wispFragments * 0.72)
    ) *
    radialGate *
    smoothstep(0.2, 0.88, cloudRadius);
  float armCloudlets = max(max(max(cloudlets, looseCloudlets * 0.82), outerCloudlets * 0.9), differentArmCloudlets * 1.05);
  float cloudComplex =
    smoothstep(0.2, 1.0, brokenArms * 0.28 + armCloudlets * 1.3) *
    smoothstep(0.32, 0.9, cloudIslands * 0.5 + clumpCloud * 0.3 + mediumCloud * 0.24) *
    (1.0 - smoothstep(0.88, 1.05, cloudRadius));
  float complexEnvelope =
    max(
      gaussian(angleDistance(spiralCoordinate, 0.13), angularWidth * 1.75),
      gaussian(angleDistance(spiralCoordinate, PI + 0.25), angularWidth * 1.85)
    ) *
    radialGate *
    cloudComplex;
  float diskMottle =
    haloMask *
    (1.0 - smoothstep(0.88, 1.16, cloudRadius)) *
    (0.28 + broadCloud * 0.34 + mediumCloud * 0.26 + fbm(vec3(cloudDisk * 6.2, u_seed * 0.203)) * 0.22);
  float armRidges =
    max(
      max(
        gaussian(angleDistance(spiralCoordinate + filamentCloud * 0.12, -0.06), angularWidth * 0.42),
        gaussian(angleDistance(spiralCoordinate - filamentCloud * 0.1, 0.32), angularWidth * 0.46)
      ),
      max(
        gaussian(angleDistance(spiralCoordinate + filamentCloud * 0.12, PI + 0.04), angularWidth * 0.46),
        gaussian(angleDistance(spiralCoordinate - filamentCloud * 0.08, PI + 0.5), angularWidth * 0.44)
      )
    ) *
    radialGate;
  float porousBreakup = smoothstep(0.34, 0.86, cloudIslands * 0.58 + mediumCloud * 0.24 + clumpCloud * 0.18);
  float armVoids = smoothstep(0.86, 0.99, darkCloud) * smoothstep(0.24, 0.9, cloudRadius);
  float armGranules =
    smoothstep(
      0.34,
      0.86,
      granularCloud(cloudDisk + broadCurl * 3.1 + vec2(0.09, -0.04), 18.0, u_seed * 0.309) * 0.56 +
        ridgedFbm(vec3(cloudRadius * 14.0, cloudAngle * 3.7, u_seed * 0.317)) * 0.34 +
        mediumCloud * 0.16
    );
  float filamentGaps =
    smoothstep(0.82, 0.98, ridgedFbm(vec3(cloudRadius * 21.0, cloudAngle * 6.2, u_seed * 0.331))) *
    smoothstep(0.18, 0.86, cloudRadius) *
    (0.38 + clumpCloud * 0.42);
  float armEdgeFray =
    smoothstep(
      0.32,
      0.82,
      fbm(vec3(cloudDisk * 27.0 + vec2(cloudAngle * 0.12, logRadius * 0.3), u_seed * 0.347)) * 0.54 +
        ridgedFbm(vec3(cloudRadius * 18.0, cloudAngle * 4.8, u_seed * 0.353)) * 0.3 +
        starCloud * 0.18
    ) *
    smoothstep(0.18, 0.9, cloudRadius);
  float armCavities =
    (
      knotLayer(cloudDisk + vec2(-0.12, 0.31), 11.0, 0.74, 0.11, 0.28) +
      knotLayer(cloudDisk + vec2(0.33, -0.22), 17.0, 0.84, 0.07, 0.19)
    ) *
    smoothstep(0.08, 0.64, brokenArms + armCloudlets * 0.72) *
    radialGate *
    smoothstep(0.22, 0.92, cloudRadius);
  float outerStellarMist =
    smoothstep(
      0.38,
      0.82,
      broadCloud * 0.35 +
        mediumCloud * 0.34 +
        fbm(vec3(cloudDisk * 5.8 + vec2(0.43, -0.27), u_seed * 0.367)) * 0.28
    ) *
    haloMask *
    smoothstep(0.36, 0.7, cloudRadius) *
    (1.0 - smoothstep(1.0, 1.14, cloudRadius));
  float cloudyOpacity = 0.18 + cloudIslands * 0.42 + mediumCloud * 0.2 + clumpCloud * 0.2 + filamentCloud * 0.06;
  float armDensity =
    (
      armScaffold * 0.012 +
      branchScaffold * 0.06 +
      brokenArms * 0.24 +
      fanFragments * 0.18 +
      featherFragments * 0.14 +
      forkFragments * 0.34 +
      spurFragments * 0.3 +
      wispFragments * 0.2 +
      armCloudlets * 1.18 +
      complexEnvelope * 0.18
    ) *
    radialGate;
  armDensity += armRidges * 0.06;
  armDensity *= cloudyOpacity * angularLopsidedness * (0.64 + porousBreakup * 0.3 + armGranules * 0.32 + armEdgeFray * 0.18);
  armDensity *= 1.0 - armVoids * 0.3 - filamentGaps * 0.14 - armCavities * 0.16;
  float armGlow = gaussian(angleDistance(spiralCoordinate, 0.12), angularWidth * 3.2);
  armGlow = max(armGlow, gaussian(angleDistance(spiralCoordinate, PI + 0.24), angularWidth * 3.3));
  armGlow = max(armGlow, branchScaffold * 0.4);
  armGlow = max(armGlow, forkFragments * 0.26 + spurFragments * 0.22 + wispFragments * 0.16) * radialGate * (0.035 + cloudIslands * 0.12);
  armGlow *= 1.0 - armVoids * 0.14;

  float coreTexture = 0.82 + softCloud(disk + vec2(0.08, -0.05), 8.5, u_seed * 0.109) * 0.2;
  float core = exp(-dot(disk / vec2(0.086, 0.068), disk / vec2(0.086, 0.068))) * coreTexture;
  float coreAsymmetry = 0.88 + 0.18 * fbm(vec3(disk * 16.0 + vec2(0.21, -0.37), u_seed * 0.401));
  float coreHaze = exp(-diskRadius * 5.35) * (0.68 + broadCloud * 0.12 + mediumCloud * 0.08) * coreAsymmetry;
  float bulge = exp(-diskRadius * 3.05) * haloMask;
  float oldStarHaze = exp(-diskRadius * 2.0) * haloMask * (0.12 + broadCloud * 0.08);
  float diffuseDisk = haloMask * (0.026 + broadCloud * 0.036 + mediumCloud * 0.026);

  float dustCoordinate = spiralCoordinate + 0.2 + mediumCloud * 0.12 - clumpCloud * 0.06 + filamentCloud * 0.035;
  float dustWidth = angularWidth * 0.56;
  float dustA = gaussian(angleDistance(dustCoordinate, 0.25), dustWidth);
  float dustB = gaussian(angleDistance(dustCoordinate, PI + 0.38), dustWidth * 1.06);
  float brokenDust = smoothstep(0.34, 0.84, ridgedFbm(vec3(cloudDisk * 7.6, u_seed * 0.083)));
  float dustLanes = max(dustA, dustB) * radialGate * (0.28 + brokenDust * 0.56);
  dustLanes += smoothstep(0.72, 0.95, darkCloud) * armDensity * 0.14;
  float coherentDust =
    max(
      gaussian(angleDistance(spiralCoordinate, 0.12 + angularWidth * 1.35), angularWidth * 0.34),
      gaussian(angleDistance(spiralCoordinate, PI + 0.24 + angularWidth * 1.25), angularWidth * 0.38)
    ) *
    radialGate *
    (0.34 + brokenDust * 0.42);
  dustLanes += coherentDust * 0.74;
  float threadNoise = smoothstep(0.38, 0.86, ridgedFbm(vec3(cloudDisk * 18.0 + vec2(cloudAngle * 0.09, logRadius * 0.4), u_seed * 0.283)));
  float thinDustThreads =
    max(
      gaussian(angleDistance(spiralCoordinate, 0.12 + angularWidth * 1.95), angularWidth * 0.16),
      gaussian(angleDistance(spiralCoordinate, PI + 0.24 + angularWidth * 1.78), angularWidth * 0.17)
    ) *
    radialGate *
    smoothstep(0.2, 0.9, cloudRadius) *
    (0.24 + threadNoise * 0.64);
  thinDustThreads +=
    max(
      gaussian(angleDistance(midSpiralCoordinate, 0.66 + angularWidth * 1.3), angularWidth * 0.13),
      gaussian(angleDistance(midSpiralCoordinate, 2.08 + angularWidth * 1.18), angularWidth * 0.12)
    ) *
    radialGate *
    smoothstep(0.28, 0.86, cloudRadius) *
    threadNoise *
    0.48;
  dustLanes += thinDustThreads * 0.54;
  float outerFeatheryDust =
    max(
      gaussian(angleDistance(openSpiralCoordinate, -0.18 + angularWidth * 1.5), angularWidth * 0.18),
      gaussian(angleDistance(openSpiralCoordinate, PI + 0.54 + angularWidth * 1.32), angularWidth * 0.16)
    ) *
    radialGate *
    smoothstep(0.46, 0.9, cloudRadius) *
    (0.16 + threadNoise * 0.42 + armEdgeFray * 0.32);
  dustLanes += outerFeatheryDust * 0.42;
  float innerDust =
    max(dustA, dustB) *
    smoothstep(0.06, 0.16, cloudRadius) *
    (1.0 - smoothstep(0.28, 0.44, cloudRadius)) *
    (0.18 + brokenDust * 0.28);
  dustLanes += innerDust;
  float innerSpiralLanes =
    max(
      gaussian(angleDistance(tightSpiralCoordinate, -0.26), angularWidth * 0.24),
      gaussian(angleDistance(tightSpiralCoordinate, PI + 0.36), angularWidth * 0.26)
    ) *
    smoothstep(0.08, 0.18, cloudRadius) *
    (1.0 - smoothstep(0.48, 0.68, cloudRadius)) *
    (0.16 + brokenDust * 0.3 + mediumCloud * 0.2);
  dustLanes += innerSpiralLanes * 0.58;
  float nuclearFiberNoise =
    smoothstep(
      0.34,
      0.9,
      ridgedFbm(vec3(cloudRadius * 32.0, cloudAngle * 8.4 + mediumCloud * 0.7, u_seed * 0.383)) * 0.58 +
        fbm(vec3(cloudDisk * 24.0 + vec2(0.18, -0.31), u_seed * 0.389)) * 0.34
    );
  float nuclearDustFibers =
    max(
      max(
        gaussian(angleDistance(tightSpiralCoordinate, -0.12), angularWidth * 0.18),
        gaussian(angleDistance(tightSpiralCoordinate, PI + 0.2), angularWidth * 0.17)
      ),
      max(
        gaussian(angleDistance(shardSpiralCoordinate, 0.34), angularWidth * 0.14),
        gaussian(angleDistance(shardSpiralCoordinate, PI - 0.28), angularWidth * 0.15)
      )
    ) *
    smoothstep(0.055, 0.13, cloudRadius) *
    (1.0 - smoothstep(0.36, 0.52, cloudRadius)) *
    (0.16 + nuclearFiberNoise * 0.58);
  dustLanes += nuclearDustFibers * 0.72;
  float nuclearRing =
    exp(-pow((cloudRadius - 0.22) / 0.045, 2.0)) *
    (0.42 + mediumCloud * 0.36 + armGranules * 0.2) *
    (1.0 - smoothstep(0.46, 0.62, cloudRadius)) *
    (1.0 - nuclearDustFibers * 0.36);
  float innerThreadWidth = min(angularWidth * 0.16, 0.065);
  float innerDustWeb =
    max(
      gaussian(angleDistance(spiralCoordinate, -0.02 + angularWidth * 1.1), innerThreadWidth),
      gaussian(angleDistance(spiralCoordinate, PI + 0.18 + angularWidth * 1.04), innerThreadWidth * 1.05)
    ) *
    smoothstep(0.1, 0.2, cloudRadius) *
    (1.0 - smoothstep(0.56, 0.74, cloudRadius)) *
    (0.22 + threadNoise * 0.44 + mediumCloud * 0.22);
  innerDustWeb +=
    max(
      gaussian(angleDistance(midSpiralCoordinate, 0.52), innerThreadWidth * 0.82),
      gaussian(angleDistance(midSpiralCoordinate, PI - 0.42), innerThreadWidth * 0.9)
    ) *
    smoothstep(0.18, 0.32, cloudRadius) *
    (1.0 - smoothstep(0.62, 0.78, cloudRadius)) *
    threadNoise *
    0.54;
  float interarmDustVeil =
    smoothstep(0.72, 0.96, darkCloud) *
    smoothstep(0.16, 0.34, cloudRadius) *
    (1.0 - smoothstep(0.72, 0.94, cloudRadius)) *
    (1.0 - smoothstep(0.08, 0.46, armDensity + brokenArms * 0.16)) *
    (0.18 + mediumCloud * 0.32);
  dustLanes += innerDustWeb * 0.42 + interarmDustVeil * 0.28;

  float knotGate =
    smoothstep(
      0.06,
      0.62,
      brokenArms * 0.25 +
        armCloudlets * 1.15 +
        complexEnvelope * 0.32 +
        fanFragments * 0.34 +
        featherFragments * 0.28 +
        forkFragments * 0.34 +
        spurFragments * 0.3 +
        wispFragments * 0.22 +
        branchScaffold * 0.35
    ) *
    radialGate;
  float blueKnots =
    (
      knotLayer(cloudDisk + vec2(0.11, -0.04), 24.0, 0.82, 0.038, 0.12) +
      knotLayer(cloudDisk + vec2(-0.2, 0.16), 42.0, 0.89, 0.024, 0.074)
    ) *
    knotGate *
    (0.58 + cloudIslands * 0.86);
  float topPearlDamping =
    1.0 -
    gaussian(angleDistance(cloudAngle, 1.7), 0.62) *
      smoothstep(0.34, 0.62, cloudRadius) *
      (1.0 - smoothstep(0.9, 1.06, cloudRadius)) *
      0.42;
  float largeAssociationDamping =
    1.0 -
    smoothstep(0.46, 0.86, cloudRadius) *
      smoothstep(0.68, 0.96, ridgedFbm(vec3(cloudRadius * 19.0, cloudAngle * 4.9, u_seed * 0.421))) *
      0.28;
  blueKnots *= topPearlDamping * largeAssociationDamping;
  float pinkKnots =
    (
      knotLayer(cloudDisk + vec2(0.24, 0.09), 22.0, 0.84, 0.034, 0.105) +
      knotLayer(cloudDisk + vec2(-0.08, -0.19), 38.0, 0.91, 0.022, 0.07)
    ) *
    knotGate *
    smoothstep(0.2, 0.86, cloudRadius);
  float diffuseHii =
    (
      knotLayer(cloudDisk + vec2(-0.31, 0.27), 8.0, 0.72, 0.105, 0.28) +
      knotLayer(cloudDisk + vec2(0.18, -0.33), 13.0, 0.82, 0.07, 0.19)
    ) *
    smoothstep(0.14, 0.82, brokenArms + complexEnvelope * 0.9) *
    radialGate *
    (0.55 + cloudIslands * 0.9);
  float smallKnotGate =
    smoothstep(
      0.08,
      0.52,
      brokenArms * 0.28 +
        armCloudlets * 0.9 +
        thinDustThreads * 0.28 +
        forkFragments * 0.2 +
        spurFragments * 0.18 +
        wispFragments * 0.16
    ) *
    radialGate *
    smoothstep(0.16, 0.84, cloudRadius);
  float blueBeadClusters =
    (
      knotLayer(cloudDisk + vec2(0.06, 0.22), 48.0, 0.916, 0.016, 0.048) +
      knotLayer(cloudDisk + vec2(0.49, -0.14), 72.0, 0.948, 0.011, 0.036) +
      knotLayer(cloudDisk + vec2(-0.34, 0.08), 92.0, 0.964, 0.008, 0.028)
    ) *
    smallKnotGate *
    (0.58 + starCloud * 0.72 + armGranules * 0.24);
  blueBeadClusters *= topPearlDamping * largeAssociationDamping;
  float pinkHiiSpeckles =
    (
      knotLayer(cloudDisk + vec2(-0.18, 0.37), 44.0, 0.93, 0.014, 0.044) +
      knotLayer(cloudDisk + vec2(0.36, 0.26), 68.0, 0.956, 0.01, 0.034)
    ) *
    smallKnotGate *
    smoothstep(0.24, 0.88, cloudRadius) *
    (0.52 + clumpCloud * 0.76);
  float innerBlueFlecks =
    (
      knotLayer(cloudDisk + vec2(0.27, -0.11), 48.0, 0.93, 0.014, 0.046) +
      knotLayer(cloudDisk + vec2(-0.15, 0.19), 72.0, 0.958, 0.01, 0.032)
    ) *
    smoothstep(0.08, 0.18, cloudRadius) *
    (1.0 - smoothstep(0.48, 0.64, cloudRadius)) *
    smoothstep(0.04, 0.42, innerSpiralLanes + brokenArms * 0.16);
  float nuclearKnotlets =
    (
      knotLayer(cloudDisk + vec2(0.19, -0.29), 58.0, 0.928, 0.012, 0.038) +
      knotLayer(cloudDisk + vec2(-0.27, 0.11), 86.0, 0.958, 0.008, 0.028)
    ) *
    nuclearRing *
    smoothstep(0.04, 0.42, innerSpiralLanes + nuclearDustFibers);
  float associationFlecks =
    (
      stellarGrain(cloudDisk + vec2(0.21, 0.47), 980.0, 0.962) +
      stellarGrain(cloudDisk + vec2(0.61, 0.18), 1320.0, 0.978)
    ) *
    diskMask *
    smoothstep(0.04, 0.54, armDensity + smallKnotGate * 0.32) *
    (1.0 - smoothstep(0.38, 0.86, dustLanes)) *
    smoothstep(0.12, 0.9, cloudRadius);
  float microAssociations =
    (
      knotLayer(cloudDisk + vec2(0.04, 0.61), 118.0, 0.972, 0.0055, 0.019) +
      knotLayer(cloudDisk + vec2(0.72, -0.05), 156.0, 0.982, 0.004, 0.014)
    ) *
    smoothstep(0.03, 0.42, armDensity + smallKnotGate * 0.38 + armGranules * 0.18) *
    diskMask *
    smoothstep(0.18, 0.92, cloudRadius) *
    (1.0 - smoothstep(0.34, 0.88, dustLanes));
  float mistStars =
    (
      stellarGrain(cloudDisk + vec2(0.38, 0.74), 690.0, 0.955) +
      stellarGrain(cloudDisk + vec2(0.92, 0.36), 1040.0, 0.974)
    ) *
    outerStellarMist *
    diskMask *
    (1.0 - smoothstep(0.22, 0.78, dustLanes));
  float blueClusters = (armDensity + armRidges * 0.1) * smoothstep(0.46, 0.9, clumpCloud + starCloud * 0.3);
  float pinkNebulae =
    armDensity *
    smoothstep(0.65, 0.96, starCloud + mediumCloud * 0.15 + filamentCloud * 0.04) *
    smoothstep(0.2, 0.82, cloudRadius);
  float embeddedStars =
    starLayer(cloudDisk * 0.22 + vec2(0.5), 190.0, 0.974, 0.4) +
    starLayer(cloudDisk * 0.27 + vec2(0.13, 0.77), 330.0, 0.989, 0.3);
  embeddedStars *= diskMask * smoothstep(0.08, 0.64, armDensity + diffuseDisk * 1.2);
  float diskGrain =
    stellarGrain(cloudDisk + vec2(0.5), 260.0, 0.935) * (0.18 + oldStarHaze * 2.2) +
    stellarGrain(cloudDisk + vec2(0.17, 0.81), 430.0, 0.963) * (0.1 + haloMask * 0.22);
  diskGrain *= diskMask * (1.0 - dustLanes * 0.48);
  float innerOldStarGrain =
    (
      stellarGrain(cloudDisk + vec2(0.44, 0.28), 520.0, 0.944) +
      stellarGrain(cloudDisk + vec2(0.76, 0.62), 850.0, 0.97)
    ) *
    smoothstep(0.08, 0.22, cloudRadius) *
    (1.0 - smoothstep(0.66, 0.86, cloudRadius)) *
    haloMask *
    (1.0 - dustLanes * 0.46);
  float interarmStars =
    (
      stellarGrain(cloudDisk + vec2(0.29, 0.57), 520.0, 0.947) +
      stellarGrain(cloudDisk + vec2(0.84, 0.23), 760.0, 0.968)
    ) *
    diskMask *
    smoothstep(0.06, 0.62, diskMottle) *
    (1.0 - smoothstep(0.18, 0.74, dustLanes));
  float armStarGrain =
    (
      stellarGrain(cloudDisk + vec2(0.31, 0.13), 360.0, 0.895) +
      stellarGrain(cloudDisk + vec2(0.73, 0.41), 620.0, 0.94)
    ) *
    diskMask *
    smoothstep(0.04, 0.5, armDensity + brokenArms * 0.22 + complexEnvelope * 0.35 + armRidges * 0.18) *
    (1.0 - dustLanes * 0.55);

  vec3 color = u_space_color;
  float oldStarDisk = exp(-diskRadius * 1.5) * haloMask * (0.03 + broadCloud * 0.022);
  color += vec3(0.046, 0.058, 0.09) * bulge;
  color += vec3(0.14, 0.11, 0.08) * oldStarDisk;
  color += vec3(0.065, 0.08, 0.12) * diskMottle * 0.36;
  color += vec3(0.055, 0.074, 0.118) * oldStarHaze;
  color += vec3(0.038, 0.05, 0.08) * haloMask * (0.22 + diskMottle * 0.52 + diffuseDisk * 1.9);
  color += vec3(0.06, 0.074, 0.105) * outerStellarMist * 0.26;
  color += u_arm_color * (armDensity * 1.08 + armGlow * 0.02 + diffuseDisk * 0.36);
  color += vec3(0.68, 0.76, 0.9) * (complexEnvelope * 0.12 + armCloudlets * 0.52 + armEdgeFray * 0.018);
  color += vec3(0.5, 0.62, 0.82) * (fanFragments * 0.045 + featherFragments * 0.038) * radialGate;
  color += vec3(0.56, 0.68, 0.88) * (forkFragments * 0.11 + spurFragments * 0.1 + wispFragments * 0.074) * radialGate;
  color += vec3(0.74, 0.82, 0.94) * (armRidges * 0.006 + brokenArms * 0.008);
  color += u_cluster_color * (blueClusters * 0.46 + blueKnots * 1.22);
  color += vec3(0.98, 0.34, 0.5) * (pinkNebulae * 0.18 + pinkKnots * 0.92 + diffuseHii * 0.72);
  color +=
    vec3(0.68, 0.86, 1.0) *
    (
      blueBeadClusters * 0.94 +
        innerBlueFlecks * 0.82 +
        nuclearKnotlets * 0.68 +
        associationFlecks * 1.02 +
        microAssociations * 0.8 +
        mistStars * 0.26
    );
  color += vec3(1.0, 0.32, 0.48) * pinkHiiSpeckles * 0.72;
  color += u_core_color * (core * 0.86 + coreHaze * 0.3 + bulge * 0.18);
  color += vec3(0.74, 0.86, 1.0) * nuclearRing * 0.035;
  color += vec3(0.92, 0.84, 0.68) * diskGrain * 0.42;
  color += vec3(0.9, 0.78, 0.56) * innerOldStarGrain * 0.52;
  color += vec3(0.72, 0.8, 0.95) * interarmStars * 0.46;
  color += vec3(0.74, 0.86, 1.0) * armStarGrain * (0.94 + armGranules * 0.28);
  color += vec3(0.8, 0.84, 0.9) * embeddedStars * 0.44;
  color +=
    vec3(0.2, 0.12, 0.08) *
    (
      dustLanes * 0.16 +
        coherentDust * 0.16 +
        thinDustThreads * 0.12 +
        outerFeatheryDust * 0.1 +
        innerDustWeb * 0.1 +
        nuclearDustFibers * 0.12
    );
  color *=
    1.0 -
    clamp(
      (
        dustLanes * 0.3 +
        coherentDust * 0.06 +
        thinDustThreads * 0.12 +
        outerFeatheryDust * 0.08 +
        innerDustWeb * 0.12 +
        nuclearDustFibers * 0.16 +
        interarmDustVeil * 0.08 +
        armCavities * 0.1
      ) * diskMask,
      0.0,
      0.44
    );
  color *= 0.38 + diskMask * 0.8 + haloMask * 0.28;

  float starA = starLayer(uv, 96.0, 0.975, 0.55);
  float starB = starLayer(uv + vec2(0.37, 0.19), 168.0, 0.985, 0.42);
  float starC = starLayer(uv + vec2(0.11, 0.73), 320.0, 0.992, 0.32);
  float starD = starLayer(uv + vec2(0.71, 0.41), 520.0, 0.996, 0.2);
  float galaxyMask = smoothstep(0.06, 0.72, diskMask * (armDensity + armGlow * 0.7 + diffuseDisk * 0.8 + core * 0.34));
  vec3 starColor = mix(vec3(0.62, 0.78, 1.0), vec3(1.0, 0.86, 0.62), hash21(uv * 120.0 + u_seed));
  color += starColor * (starA + starB + starC + starD) * (1.0 - galaxyMask * 0.28);

  float vignette = smoothstep(1.42, 0.12, length(centered));
  color *= 0.72 + vignette * 0.5;
  color = pow(max(color, vec3(0.0)), vec3(0.92));
  color = color / (1.0 + color * 0.18);

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createSpiralGalaxyShaderTexture(
  scene: Phaser.Scene,
  textureKey: string,
  textureSize: number,
  displaySize: { height: number; width: number },
): boolean {
  return createShaderTexture(scene, textureKey, fragmentShader, textureSize, (gl, program) => {
    setFloatUniform(gl, program, 'u_display_aspect', displaySize.width / displaySize.height);
    setFloatUniform(gl, program, 'u_seed', 908.173);
    setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
    setVec3Uniform(gl, program, 'u_core_color', hexToVec3Uniform('#ddb06e'));
    setVec3Uniform(gl, program, 'u_arm_color', hexToVec3Uniform('#4d617f'));
    setVec3Uniform(gl, program, 'u_dust_color', hexToVec3Uniform('#35212f'));
    setVec3Uniform(gl, program, 'u_cluster_color', hexToVec3Uniform('#78afd2'));
    setVec3Uniform(gl, program, 'u_space_color', hexToVec3Uniform('#03050d'));
  });
}
