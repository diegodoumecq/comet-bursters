import Phaser from 'phaser';

import type { PlanetEntity } from '../types';
import {
  createPlanetShaderTexture,
  getPlanetShaderSeed,
  hexToVec3Uniform,
  setFloatUniform,
  setVec2Uniform,
  setVec3Uniform,
} from './planetShaderTexture';

const VISIBLE_ALPHA_THRESHOLD = 0.003;

const fragmentShader = `
precision highp float;

uniform float u_radius;
uniform float u_rotation;
uniform float u_seed;
uniform vec2 u_texture_size;
uniform vec3 u_base_color;

const float VISIBLE_ALPHA_THRESHOLD = ${VISIBLE_ALPHA_THRESHOLD.toFixed(3)};

mat3 rotateY(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(
    c, 0.0, -s,
    0.0, 1.0, 0.0,
    s, 0.0, c
  );
}

float waveNoise(vec3 p) {
  vec3 q = p + u_seed * vec3(0.013, 0.019, 0.011);
  float a = sin(dot(q, vec3(1.47, 0.72, -1.19)) + sin(dot(q, vec3(-0.31, 1.83, 0.68))) * 1.34);
  float b = sin(dot(q, vec3(-1.91, 1.26, 0.77)) + cos(dot(q, vec3(1.13, 0.41, -1.48))) * 1.12);
  float c = sin(dot(q, vec3(0.84, -1.57, 1.38)) + sin(length(q + vec3(1.2, -2.1, 0.7))) * 1.7);
  float d = sin(length(q * vec3(1.08, 0.92, 1.16) + vec3(2.4, -1.7, 0.9)) * 1.46);
  return clamp(0.5 + (a * 0.3 + b * 0.27 + c * 0.25 + d * 0.18) * 0.5, 0.0, 1.0);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 6; i++) {
    value += waveNoise(p) * amplitude;
    p = mat3(
      0.78, -0.48, 0.39,
      0.57, 0.80, -0.18,
      -0.25, 0.36, 0.90
    ) * p * 2.04 + vec3(7.1, 3.9, 5.4);
    amplitude *= 0.52;
  }
  return value;
}

float ridgedFbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.52;
  for (int i = 0; i < 5; i++) {
    float ridge = 1.0 - abs(waveNoise(p) * 2.0 - 1.0);
    value += ridge * ridge * amplitude;
    p = mat3(
      0.63, -0.62, 0.47,
      0.69, 0.72, 0.08,
      -0.39, 0.27, 0.88
    ) * p * 2.22 + vec3(4.9, 8.1, 2.7);
    amplitude *= 0.56;
  }
  return value;
}

float crackLayer(vec3 p, vec3 direction, float frequency, float phase, float width) {
  vec3 dir = normalize(direction);
  float warp =
    fbm(p * 0.52 + dir * 2.7 + vec3(phase)) * 1.4 +
    ridgedFbm(p * 0.36 + dir.yzx * 1.9 - vec3(phase)) * 0.9;
  float line = sin(dot(p, dir) * frequency + warp * 2.8 + phase);
  return 1.0 - smoothstep(width, width * 3.0, abs(line));
}

float crackNetwork(vec3 p) {
  float broad =
    crackLayer(p, vec3(1.0, 0.18, -0.44), 9.4, u_seed * 0.031, 0.105) * 0.34 +
    crackLayer(p, vec3(-0.28, 1.0, 0.38), 10.8, u_seed * 0.047 + 1.9, 0.085) * 0.3 +
    crackLayer(p, vec3(0.36, -0.52, 1.0), 12.2, u_seed * 0.023 + 3.1, 0.074) * 0.28;
  float fine =
    crackLayer(p, vec3(0.82, -0.56, 0.24), 22.0, u_seed * 0.019 + 0.6, 0.038) * 0.22 +
    crackLayer(p, vec3(-0.43, 0.38, 1.0), 27.0, u_seed * 0.041 + 0.8, 0.031) * 0.2 +
    crackLayer(p, vec3(0.18, 1.0, -0.76), 33.0, u_seed * 0.037 + 2.4, 0.026) * 0.16;
  return clamp(broad + fine, 0.0, 1.0);
}

vec3 paintPosterize(vec3 color) {
  return floor(color * 14.0 + 0.5) / 14.0;
}

vec3 lavaPaintPalette(float value) {
  if (value < 0.16) return vec3(0.018, 0.004, 0.003);
  if (value < 0.32) return vec3(0.10, 0.018, 0.010);
  if (value < 0.48) return vec3(0.24, 0.040, 0.018);
  if (value < 0.64) return vec3(0.48, 0.085, 0.030);
  if (value < 0.80) return vec3(0.82, 0.18, 0.045);
  return vec3(1.0, 0.58, 0.15);
}

float hashNoise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 0.013) * 43758.5453123);
}

float paperNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  float bottomLeft = hashNoise(cell);
  float bottomRight = hashNoise(cell + vec2(1.0, 0.0));
  float topLeft = hashNoise(cell + vec2(0.0, 1.0));
  float topRight = hashNoise(cell + vec2(1.0, 1.0));
  return mix(mix(bottomLeft, bottomRight, blend.x), mix(topLeft, topRight, blend.x), blend.y);
}

vec3 applyPaintPostProcess(vec3 color, vec2 planetPosition) {
  vec2 paperUv = planetPosition * 0.5 + 0.5;
  float paperGrain = paperNoise(paperUv * 72.0) - 0.5;
  float value = dot(color, vec3(0.42, 0.38, 0.2));
  float bandedValue = floor(clamp(value + paperGrain * 0.055, 0.0, 1.0) * 6.0) / 5.0;
  vec3 paletteColor = lavaPaintPalette(bandedValue);
  vec3 painted = mix(paletteColor, color, 0.14);

  float canvasTooth =
    (sin((paperUv.x + paperUv.y * 0.24) * 210.0 + u_seed * 0.017) *
      sin((paperUv.y - paperUv.x * 0.16) * 184.0 + u_seed * 0.011)) *
      0.5 +
    0.5;
  float brushDirection = sin((paperUv.x * 42.0 + paperUv.y * 18.0) + paperNoise(paperUv * 14.0) * 1.6);
  float texture = paperGrain * 0.075 + (canvasTooth - 0.5) * 0.08 + brushDirection * 0.028;

  painted *= 1.0 + texture;
  painted = mix(vec3(dot(painted, vec3(0.299, 0.587, 0.114))), painted, 0.86);
  return clamp(painted, 0.0, 1.0);
}

vec3 tint(vec3 color, float amount) {
  vec3 target = amount >= 0.0 ? vec3(1.0) : vec3(0.02, 0.012, 0.008);
  return mix(color, target, abs(amount));
}

vec4 sampleLavaSurface(vec3 normal) {
  vec3 rotatedNormal = rotateY(u_rotation) * normal;
  vec3 seedOffset = vec3(u_seed * 0.017, u_seed * 0.023, u_seed * 0.013);
  vec3 broadPosition = rotatedNormal * 3.3 + seedOffset;
  vec3 warp = vec3(
    fbm(broadPosition * 1.15 + vec3(2.4, 9.1, 1.8)),
    fbm(broadPosition * 1.28 + vec3(8.8, 1.6, 4.2)),
    fbm(broadPosition * 1.08 + vec3(4.6, 5.7, 8.9))
  ) - 0.5;
  vec3 q = rotatedNormal * 4.75 + warp * 1.2 + seedOffset * 0.36;

  float crustMass = fbm(q * 0.92 + vec3(0.8, 2.0, 1.4));
  float ashMottle = fbm(q * 5.2 + vec3(6.0, 3.4, 8.2));
  float fineAsh = fbm(q * 10.5 + warp * 2.4 + vec3(1.5, 7.7, 2.2));
  float ridge = ridgedFbm(q * 2.2 + warp * 1.54);
  float foldedCrust = ridgedFbm(q * 3.65 + warp * 2.1 + vec3(3.7, 1.2, 5.5));
  float veinNetwork = crackNetwork(q + warp * 0.62);
  float darkPlates = smoothstep(0.39, 0.78, crustMass * 0.44 + ashMottle * 0.29 + foldedCrust * 0.32);
  float paintedPlateTone = floor((crustMass * 0.5 + foldedCrust * 0.32 + ashMottle * 0.18) * 5.0 + 0.5) / 5.0;
  float char = smoothstep(0.54, 0.88, foldedCrust * 0.42 + ashMottle * 0.28 + crustMass * 0.24);
  float moltenFields = smoothstep(
    0.57,
    0.87,
    (1.0 - crustMass) * 0.28 + ridge * 0.22 + veinNetwork * 0.2 + foldedCrust * 0.16
  );
  float fissures = smoothstep(0.34, 0.72, veinNetwork * 0.74 + ridge * 0.26 + foldedCrust * 0.12);
  float hairlineCracks = smoothstep(0.56, 0.84, veinNetwork * 0.38 + foldedCrust * 0.34 + fineAsh * 0.18);
  float lavaPools = smoothstep(
    0.5,
    0.84,
    (1.0 - crustMass) * 0.34 + veinNetwork * 0.32 + ridge * 0.18 + foldedCrust * 0.12
  );
  float emberDust = smoothstep(0.68, 0.92, fineAsh * 0.5 + ridge * 0.18 + veinNetwork * 0.12);

  vec3 basalt = mix(u_base_color, vec3(0.03, 0.009, 0.007), 0.84);
  vec3 iron = mix(u_base_color, vec3(0.28, 0.062, 0.027), 0.42);
  vec3 emberCrust = mix(u_base_color, vec3(0.46, 0.1, 0.035), 0.28);
  vec3 crust = mix(iron, basalt, darkPlates * 0.62 + paintedPlateTone * 0.28);
  crust = mix(crust, emberCrust, moltenFields * 0.12);
  crust = mix(crust, paintPosterize(crust), 0.64);
  crust = mix(crust, vec3(0.025, 0.006, 0.004), char * 0.22 + darkPlates * 0.14);

  vec3 magma = vec3(1.0, 0.2, 0.045);
  vec3 hotMagma = vec3(1.0, 0.56, 0.16);
  vec3 sulfur = vec3(1.0, 0.86, 0.42);
  vec3 color = crust;
  color = mix(color, magma, fissures * 0.74 + lavaPools * 0.16 + moltenFields * 0.03);
  color = mix(color, hotMagma, lavaPools * 0.32 + hairlineCracks * 0.2 + moltenFields * 0.02);
  color = mix(color, sulfur, hairlineCracks * 0.16 + emberDust * 0.08);
  color = mix(color, paintPosterize(color), 0.3);
  color += magma * emberDust * 0.1;

  color += (magma * fissures + hotMagma * (lavaPools + hairlineCracks * 0.34)) * 0.12;

  return vec4(color, 1.0);
}

void main() {
  vec2 pixel = gl_FragCoord.xy - vec2(0.5);
  vec2 center = u_texture_size * 0.5;
  vec2 planetPosition = (pixel - center) / max(u_radius, 1.0);
  planetPosition.y *= -1.0;

  float distanceFromCenter = length(planetPosition);
  float bodyAlpha = 1.0 - smoothstep(0.992, 1.006, distanceFromCenter);

  if (bodyAlpha <= VISIBLE_ALPHA_THRESHOLD) {
    discard;
  }

  float z = sqrt(max(0.0, 1.0 - distanceFromCenter * distanceFromCenter));
  vec3 normal = normalize(vec3(planetPosition.x, planetPosition.y, z));
  vec4 surface = sampleLavaSurface(normal);
  vec3 paintedSurface = applyPaintPostProcess(surface.rgb, planetPosition);

  gl_FragColor = vec4(paintedSurface, bodyAlpha);
}
`;

export function createLavaPlanetShaderTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  textureSize: number,
  textureScale: number,
): boolean {
  return createPlanetShaderTexture(
    scene,
    textureKey,
    fragmentShader,
    textureSize,
    (gl, program) => {
      setVec3Uniform(gl, program, 'u_base_color', hexToVec3Uniform(planet.colorHex));
      setFloatUniform(gl, program, 'u_radius', planet.radius * textureScale);
      setFloatUniform(gl, program, 'u_rotation', planet.rotation);
      setFloatUniform(gl, program, 'u_seed', getPlanetShaderSeed(planet));
      setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
    },
  );
}
