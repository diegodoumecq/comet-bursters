import Phaser from 'phaser';

import type { PlanetEntity } from '../types';
import {
  createPlanetShaderTexture,
  hexToVec3Uniform,
  setFloatUniform,
  setVec2Uniform,
  setVec3Uniform,
  type Vec3Uniform,
} from './planetShaderTexture';

type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type SphereLightingSample = {
  alpha: number;
  blue: number;
  green: number;
  red: number;
};

const LIGHT_DIRECTION = normalize3({ x: -0.56, y: -0.52, z: 0.65 });
const LIGHT_BANDS = 16;
const AMBIENT_RIM_ALPHA = 0.16;
const MAX_SHADOW_ALPHA = 0.46;
const RIM_SHADOW_ALPHA = 0.12;

const ATMOSPHERE_STYLES: Record<
  PlanetEntity['kind'],
  { alpha: number; color: Vec3Uniform; outerRadius: number }
> = {
  crystal: { alpha: 0.34, color: hexToVec3Uniform('#b7f3ff'), outerRadius: 1.09 },
  desert: { alpha: 0.18, color: hexToVec3Uniform('#f0b070'), outerRadius: 1.06 },
  gas: { alpha: 0.38, color: hexToVec3Uniform('#bda8ff'), outerRadius: 1.11 },
  ice: { alpha: 0.34, color: hexToVec3Uniform('#d7fbff'), outerRadius: 1.1 },
  lava: { alpha: 0.18, color: hexToVec3Uniform('#ff6a33'), outerRadius: 1.06 },
  lush: { alpha: 0.32, color: hexToVec3Uniform('#9cffc2'), outerRadius: 1.09 },
  toxic: { alpha: 0.34, color: hexToVec3Uniform('#b4ff4d'), outerRadius: 1.09 },
};

const fragmentShader = `
precision mediump float;

uniform vec2 u_texture_size;
uniform float u_radius;
uniform vec3 u_atmosphere_color;
uniform float u_atmosphere_alpha;
uniform float u_atmosphere_outer_radius;
uniform vec3 u_light_direction;
uniform float u_light_bands;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float quantize(float value, float bands) {
  float bandCount = max(1.0, bands - 1.0);
  return floor(saturate(value) * bandCount + 0.5) / bandCount;
}

vec4 sampleQuantizedSphereLighting(vec3 normal) {
  float light = dot(normal, normalize(u_light_direction));
  float banded = quantize((light + 1.0) * 0.5, u_light_bands);
  float signedLight = banded * 2.0 - 1.0;
  float ambientRim = pow(saturate(1.0 - normal.z), 2.35) * ${AMBIENT_RIM_ALPHA.toFixed(2)};
  float rimShadow = pow(saturate(1.0 - normal.z), 1.9) * ${RIM_SHADOW_ALPHA.toFixed(2)};

  if (signedLight >= 0.0) {
    return vec4(3.0 / 255.0, 8.0 / 255.0, 12.0 / 255.0, ambientRim);
  }

  float alpha = saturate(
    pow(-signedLight, 1.04) * ${MAX_SHADOW_ALPHA.toFixed(2)} +
    rimShadow +
    ambientRim
  );
  return vec4(3.0 / 255.0, 8.0 / 255.0, 12.0 / 255.0, alpha);
}

void main() {
  vec2 pixel = gl_FragCoord.xy - vec2(0.5);
  vec2 center = u_texture_size * 0.5;
  vec2 planetPosition = (pixel - center) / max(u_radius, 1.0);
  planetPosition.y *= -1.0;

  float distanceFromCenter = length(planetPosition);
  float bodyAlpha = 1.0 - smoothstep(0.992, 1.006, distanceFromCenter);

  if (distanceFromCenter > 1.0) {
    float atmosphereAlpha =
      (1.0 - smoothstep(1.0, u_atmosphere_outer_radius, distanceFromCenter)) *
      u_atmosphere_alpha;

    if (atmosphereAlpha <= 0.001) {
      discard;
    }

    gl_FragColor = vec4(u_atmosphere_color, atmosphereAlpha);
    return;
  }

  if (bodyAlpha <= 0.001) {
    discard;
  }

  float z = sqrt(max(0.0, 1.0 - distanceFromCenter * distanceFromCenter));
  vec3 normal = normalize(vec3(planetPosition.x, planetPosition.y, z));
  vec4 lighting = sampleQuantizedSphereLighting(normal);
  float outerShadow = smoothstep(0.982, 1.0, distanceFromCenter) * 0.32;

  if (outerShadow > lighting.a) {
    lighting = vec4(3.0 / 255.0, 6.0 / 255.0, 12.0 / 255.0, outerShadow);
  }

  float innerAtmosphere = smoothstep(0.88, 0.998, distanceFromCenter) * u_atmosphere_alpha * 0.55;
  if (innerAtmosphere > lighting.a) {
    lighting = vec4(u_atmosphere_color, innerAtmosphere);
  }

  gl_FragColor = vec4(lighting.rgb, lighting.a * bodyAlpha);
}
`;

export function createPlanetLightingShaderTexture(
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
      const atmosphere = ATMOSPHERE_STYLES[planet.kind];
      setFloatUniform(gl, program, 'u_radius', planet.radius * textureScale);
      setFloatUniform(gl, program, 'u_atmosphere_alpha', atmosphere.alpha);
      setFloatUniform(gl, program, 'u_atmosphere_outer_radius', atmosphere.outerRadius);
      setFloatUniform(gl, program, 'u_light_bands', LIGHT_BANDS);
      setVec3Uniform(gl, program, 'u_atmosphere_color', atmosphere.color);
      setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
      setVec3Uniform(gl, program, 'u_light_direction', toVec3Uniform(LIGHT_DIRECTION));
    },
  );
}

export function sampleQuantizedSphereLighting(normal: Vec3): SphereLightingSample {
  const light = dot3(normal, LIGHT_DIRECTION);
  const banded = quantize((light + 1) * 0.5, LIGHT_BANDS);
  const signedLight = banded * 2 - 1;
  const ambientRim = Math.pow(clamp01(1 - normal.z), 2.35) * AMBIENT_RIM_ALPHA;
  const rimShadow = Math.pow(clamp01(1 - normal.z), 1.9) * RIM_SHADOW_ALPHA;

  if (signedLight >= 0) {
    return {
      alpha: ambientRim,
      blue: 12,
      green: 8,
      red: 3,
    };
  }

  return {
    alpha: clamp01(Math.pow(-signedLight, 1.04) * MAX_SHADOW_ALPHA + rimShadow + ambientRim),
    blue: 12,
    green: 8,
    red: 3,
  };
}

function toVec3Uniform(vector: Vec3): Vec3Uniform {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function quantize(value: number, bands: number): number {
  const bandCount = Math.max(1, bands - 1);
  return Math.round(clamp01(value) * bandCount) / bandCount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalize3(vector: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= 0) return { x: 0, y: 0, z: 1 };
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
