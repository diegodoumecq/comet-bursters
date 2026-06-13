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

type AtmosphereStyle = {
  alpha: number;
  color: Vec3Uniform;
  outerRadius: number;
};

type LightingStyle = {
  maxShadowAlpha: number;
  outerShadowAlpha: number;
  rimShadowAlpha: number;
  shadowColor: Vec3Uniform;
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
const OUTER_SHADOW_ALPHA = 0.32;

const ATMOSPHERE_STYLES: Record<PlanetEntity['kind'], AtmosphereStyle> = {
  crystal: { alpha: 0.58, color: hexToVec3Uniform('#b7f3ff'), outerRadius: 1.16 },
  desert: { alpha: 0.34, color: hexToVec3Uniform('#f0b070'), outerRadius: 1.1 },
  gas: { alpha: 0.66, color: hexToVec3Uniform('#bda8ff'), outerRadius: 1.18 },
  ice: { alpha: 0.62, color: hexToVec3Uniform('#d7fbff'), outerRadius: 1.17 },
  lava: { alpha: 0.36, color: hexToVec3Uniform('#ff6a33'), outerRadius: 1.1 },
  lush: { alpha: 0.6, color: hexToVec3Uniform('#9cffc2'), outerRadius: 1.16 },
  toxic: { alpha: 0.62, color: hexToVec3Uniform('#b4ff4d'), outerRadius: 1.16 },
};

const DEFAULT_LIGHTING_STYLE: LightingStyle = {
  maxShadowAlpha: MAX_SHADOW_ALPHA,
  outerShadowAlpha: OUTER_SHADOW_ALPHA,
  rimShadowAlpha: RIM_SHADOW_ALPHA,
  shadowColor: defaultShadowColor(),
};

const CRYSTAL_LIGHTING_STYLE: LightingStyle = {
  maxShadowAlpha: 0.18,
  outerShadowAlpha: 0.12,
  rimShadowAlpha: 0.045,
  shadowColor: hexToVec3Uniform('#6ecfff'),
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
uniform float u_max_shadow_alpha;
uniform float u_outer_shadow_alpha;
uniform float u_rim_shadow_alpha;
uniform vec3 u_shadow_color;

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
  float rimShadow = pow(saturate(1.0 - normal.z), 1.9) * u_rim_shadow_alpha;

  if (signedLight >= 0.0) {
    return vec4(u_shadow_color, ambientRim);
  }

  float alpha = saturate(
    pow(-signedLight, 1.04) * u_max_shadow_alpha +
    rimShadow +
    ambientRim
  );
  return vec4(u_shadow_color, alpha);
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
  float outerShadow = smoothstep(0.982, 1.0, distanceFromCenter) * u_outer_shadow_alpha;

  if (outerShadow > lighting.a) {
    lighting = vec4(u_shadow_color, outerShadow);
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
      const lighting = getLightingStyle(planet.kind);
      setFloatUniform(gl, program, 'u_radius', planet.radius * textureScale);
      setFloatUniform(gl, program, 'u_atmosphere_alpha', atmosphere.alpha);
      setFloatUniform(gl, program, 'u_atmosphere_outer_radius', atmosphere.outerRadius);
      setFloatUniform(gl, program, 'u_light_bands', LIGHT_BANDS);
      setFloatUniform(gl, program, 'u_max_shadow_alpha', lighting.maxShadowAlpha);
      setFloatUniform(gl, program, 'u_outer_shadow_alpha', lighting.outerShadowAlpha);
      setFloatUniform(gl, program, 'u_rim_shadow_alpha', lighting.rimShadowAlpha);
      setVec3Uniform(gl, program, 'u_atmosphere_color', atmosphere.color);
      setVec3Uniform(gl, program, 'u_shadow_color', lighting.shadowColor);
      setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
      setVec3Uniform(gl, program, 'u_light_direction', toVec3Uniform(LIGHT_DIRECTION));
    },
  );
}

export function sampleQuantizedSphereLighting(
  normal: Vec3,
  style: Partial<Pick<LightingStyle, 'maxShadowAlpha' | 'rimShadowAlpha' | 'shadowColor'>> = {},
): SphereLightingSample {
  const light = dot3(normal, LIGHT_DIRECTION);
  const banded = quantize((light + 1) * 0.5, LIGHT_BANDS);
  const signedLight = banded * 2 - 1;
  const ambientRim = Math.pow(clamp01(1 - normal.z), 2.35) * AMBIENT_RIM_ALPHA;
  const rimShadow =
    Math.pow(clamp01(1 - normal.z), 1.9) * (style.rimShadowAlpha ?? RIM_SHADOW_ALPHA);
  const shadowColor = style.shadowColor ?? defaultShadowColor();

  if (signedLight >= 0) {
    return {
      alpha: ambientRim,
      blue: Math.round(shadowColor.z * 255),
      green: Math.round(shadowColor.y * 255),
      red: Math.round(shadowColor.x * 255),
    };
  }

  return {
    alpha: clamp01(
      Math.pow(-signedLight, 1.04) * (style.maxShadowAlpha ?? MAX_SHADOW_ALPHA) +
        rimShadow +
        ambientRim,
    ),
    blue: Math.round(shadowColor.z * 255),
    green: Math.round(shadowColor.y * 255),
    red: Math.round(shadowColor.x * 255),
  };
}

function getLightingStyle(kind: PlanetEntity['kind']): LightingStyle {
  if (kind === 'crystal') return CRYSTAL_LIGHTING_STYLE;
  return DEFAULT_LIGHTING_STYLE;
}

function defaultShadowColor(): Vec3Uniform {
  return {
    x: 3 / 255,
    y: 8 / 255,
    z: 12 / 255,
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
