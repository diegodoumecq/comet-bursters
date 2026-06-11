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

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
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

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

vec3 hash33(vec3 p) {
  return fract(
    sin(vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    )) * 43758.5453123
  );
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
  float amplitude = 0.54;
  for (int i = 0; i < 6; i++) {
    value += valueNoise(p) * amplitude;
    p = mat3(
      0.77, -0.49, 0.41,
      0.58, 0.81, -0.08,
      -0.27, 0.30, 0.92
    ) * p * 2.05 + vec3(6.2, 2.7, 9.1);
    amplitude *= 0.51;
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
    ) * p * 2.31 + vec3(3.7, 8.8, 1.9);
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
    ) * p * 1.84 + vec3(4.3, 7.6, 2.1);
    amplitude *= 0.53;
  }
  return value;
}

float cellular(vec3 p) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  float nearest = 10.0;

  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 offset = vec3(float(x), float(y), float(z));
        vec3 point = offset + hash33(cell + offset);
        float distanceToPoint = length(point - local);
        nearest = min(nearest, distanceToPoint);
      }
    }
  }
  return nearest;
}

float speckleField(vec3 p) {
  float cells = cellular(p);
  float dots = 1.0 - smoothstep(0.07, 0.22, cells);
  float dust = smoothstep(0.62, 0.92, valueNoise(p * 1.73 + vec3(8.1, 2.3, 5.7)));
  return dots * dust;
}

vec3 tint(vec3 color, float amount) {
  vec3 target = amount >= 0.0 ? vec3(0.92, 1.0, 0.62) : vec3(0.0, 0.035, 0.02);
  return mix(color, target, abs(amount));
}

vec4 sampleToxicSurface(vec2 sphereUv, vec3 normal) {
  vec3 rotatedNormal = rotateY(u_rotation) * normal;
  vec3 seedOffset = vec3(u_seed * 0.023, u_seed * 0.017, u_seed * 0.029);
  vec3 basePosition = rotatedNormal * 2.35 + seedOffset;
  vec3 warp = vec3(
    billowFbm(basePosition * 0.86 + vec3(8.2, 1.7, 3.1)),
    fbm(basePosition * 1.04 + vec3(2.6, 7.4, 5.5)),
    billowFbm(basePosition * 0.72 + vec3(4.8, 3.2, 9.0))
  ) - 0.5;
  vec3 q = rotatedNormal * 3.15 + warp * 1.72 + seedOffset * 0.38;

  float murk = fbm(q * 0.62 + vec3(1.8, 2.4, 7.2));
  float billows = billowFbm(q * 1.08 + warp * 1.18);
  float oily = fbm(q * 2.45 + vec3(7.1, 3.8, 1.6));
  float fineFilm = billowFbm(q * 6.4 + warp * 1.9 + vec3(1.2, 8.4, 4.1));
  float softRidges = ridgedFbm(q * 1.35 + warp * 0.7);
  float largeCells = cellular(q * 1.26 + warp * 0.82);
  float mediumCells = cellular(q * 3.45 + warp * 1.28 + vec3(3.5, 6.8, 1.7));
  float tinySpores = speckleField(q * 11.0 + warp * 2.3 + vec3(6.2, 1.1, 9.3));

  float latitudeBands =
    sin((sphereUv.y * 6.7 + sphereUv.x * 0.9 + warp.x * 0.3 + billows * 0.24) * TAU) * 0.5 + 0.5;
  float oilyBands =
    sin((sphereUv.x * 3.8 - sphereUv.y * 5.2 + oily * 0.65 + warp.y * 0.34) * TAU) * 0.5 + 0.5;
  float smogBands = smoothstep(0.42, 0.82, latitudeBands * 0.4 + oilyBands * 0.18 + billows * 0.28);

  float cellCore = 1.0 - smoothstep(0.18, 0.58, largeCells);
  float cellRim = smoothstep(0.26, 0.48, largeCells) * (1.0 - smoothstep(0.48, 0.76, largeCells));
  float acidLagoons = smoothstep(0.48, 0.82, cellCore * 0.54 + billows * 0.26 + smogBands * 0.18);
  float algaeMats = smoothstep(0.54, 0.88, (1.0 - mediumCells) * 0.34 + oily * 0.36 + murk * 0.22);
  float cyanSlicks = smoothstep(0.5, 0.86, fineFilm * 0.42 + cellRim * 0.32 + oilyBands * 0.14);
  float darkBrine = smoothstep(0.56, 0.9, murk * 0.46 + softRidges * 0.24 + oily * 0.18);
  float yellowBloom = smoothstep(0.62, 0.93, acidLagoons * 0.48 + fineFilm * 0.28 + cellRim * 0.2);
  float purpleScum = smoothstep(
    0.5,
    0.86,
    tinySpores * 0.58 + (1.0 - mediumCells) * 0.16 + fineFilm * 0.18
  );

  vec3 blackwater = mix(u_base_color, vec3(0.0, 0.055, 0.058), 0.76);
  vec3 deepTeal = mix(u_base_color, vec3(0.0, 0.25, 0.2), 0.58);
  vec3 algae = vec3(0.16, 0.62, 0.24);
  vec3 acid = vec3(0.74, 1.0, 0.12);
  vec3 chartreuse = vec3(0.9, 0.98, 0.32);
  vec3 cyanSlick = vec3(0.02, 0.82, 0.76);
  vec3 violetWaste = vec3(0.72, 0.18, 0.82);

  vec3 color = mix(blackwater, deepTeal, murk * 0.62 + smogBands * 0.16);
  color = mix(color, algae, algaeMats * 0.34 + billows * 0.12);
  color = mix(color, vec3(0.0, 0.034, 0.034), darkBrine * 0.38);
  color = mix(color, acid, acidLagoons * 0.44);
  color = mix(color, chartreuse, yellowBloom * 0.24 + cellRim * 0.08);
  color = mix(color, cyanSlick, cyanSlicks * 0.25);
  color = mix(color, violetWaste, purpleScum * 0.22);
  color += chartreuse * yellowBloom * 0.08;
  color += cyanSlick * cyanSlicks * 0.05;
  color += violetWaste * purpleScum * 0.06;

  color +=
    (acid * acidLagoons + chartreuse * yellowBloom + cyanSlick * cyanSlicks + violetWaste * purpleScum * 0.36) *
    0.08;

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
  vec2 sphereUv = vec2(
    atan(normal.x, normal.z) / TAU + 0.5,
    asin(clamp(normal.y, -1.0, 1.0)) / PI + 0.5
  );
  vec4 surface = sampleToxicSurface(sphereUv, normal);

  gl_FragColor = vec4(surface.rgb, bodyAlpha);
}
`;

export function createToxicPlanetShaderTexture(
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
      setFloatUniform(gl, program, 'u_seed', getPlanetShaderSeed(planet) + 17.73);
      setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
    },
  );
}
