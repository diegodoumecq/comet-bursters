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

float veinLayer(vec3 p, vec3 direction, float frequency, float phase, float width) {
  vec3 dir = normalize(direction);
  float warp =
    fbm(p * 0.62 + dir * 3.1 + vec3(phase)) * 1.24 +
    ridgedFbm(p * 0.4 + dir.yzx * 2.2 - vec3(phase)) * 0.86;
  float line = sin(dot(p, dir) * frequency + warp * 2.65 + phase);
  return 1.0 - smoothstep(width, width * 3.4, abs(line));
}

float chemicalVeins(vec3 p) {
  float broad =
    veinLayer(p, vec3(1.0, -0.16, 0.48), 8.4, u_seed * 0.023, 0.102) * 0.3 +
    veinLayer(p, vec3(-0.36, 0.88, 0.3), 11.6, u_seed * 0.039 + 1.7, 0.082) * 0.27 +
    veinLayer(p, vec3(0.22, 0.52, 1.0), 13.8, u_seed * 0.031 + 3.2, 0.066) * 0.25;
  float fine =
    veinLayer(p, vec3(0.74, 0.5, -0.44), 24.0, u_seed * 0.017 + 0.9, 0.034) * 0.23 +
    veinLayer(p, vec3(-0.48, 1.0, 0.2), 30.0, u_seed * 0.043 + 2.1, 0.026) * 0.2;
  return clamp(broad + fine, 0.0, 1.0);
}

vec3 tint(vec3 color, float amount) {
  vec3 target = amount >= 0.0 ? vec3(0.92, 1.0, 0.62) : vec3(0.0, 0.035, 0.02);
  return mix(color, target, abs(amount));
}

vec4 sampleToxicSurface(vec2 sphereUv, vec3 normal) {
  vec3 rotatedNormal = rotateY(u_rotation) * normal;
  vec3 seedOffset = vec3(u_seed * 0.019, u_seed * 0.013, u_seed * 0.021);
  vec3 basePosition = rotatedNormal * 3.45 + seedOffset;
  vec3 warp = vec3(
    fbm(basePosition * 1.08 + vec3(8.2, 1.7, 3.1)),
    fbm(basePosition * 1.21 + vec3(2.6, 7.4, 5.5)),
    fbm(basePosition * 0.94 + vec3(4.8, 3.2, 9.0))
  ) - 0.5;
  vec3 q = rotatedNormal * 4.8 + warp * 1.38 + seedOffset * 0.42;

  float continents = fbm(q * 0.78 + vec3(1.8, 2.4, 7.2));
  float swamp = fbm(q * 1.52 + warp * 1.72);
  float sludge = fbm(q * 4.4 + vec3(7.1, 3.8, 1.6));
  float fineSlime = fbm(q * 10.8 + warp * 2.5 + vec3(1.2, 8.4, 4.1));
  float ridges = ridgedFbm(q * 2.36 + warp * 1.6);
  float caustics = ridgedFbm(q * 6.4 + vec3(5.3, 2.2, 8.7));
  float cells = cellular(q * 2.45 + warp * 1.05);
  float smallCells = cellular(q * 7.4 + warp * 2.2 + vec3(3.5, 6.8, 1.7));
  float veins = chemicalVeins(q + warp * 0.72);

  float latitudeBands =
    sin((sphereUv.y * 11.4 + sphereUv.x * 1.9 + warp.x * 0.38 + swamp * 0.32) * TAU) * 0.5 + 0.5;
  float shearBands =
    sin((sphereUv.x * 8.2 - sphereUv.y * 4.6 + ridges * 0.72 + warp.y * 0.24) * TAU) * 0.5 + 0.5;
  float murkBands = smoothstep(0.48, 0.91, latitudeBands * 0.38 + shearBands * 0.2 + ridges * 0.26);

  float acidLakes = smoothstep(0.55, 0.84, (1.0 - cells) * 0.62 + swamp * 0.22 + murkBands * 0.12);
  float lakeEdges = smoothstep(0.34, 0.52, 1.0 - cells) * (1.0 - smoothstep(0.52, 0.78, 1.0 - cells));
  float bloomedPools = smoothstep(0.52, 0.88, acidLakes * 0.5 + caustics * 0.26 + (1.0 - smallCells) * 0.2);
  float crustRot = smoothstep(0.48, 0.82, continents * 0.38 + sludge * 0.34 + ridges * 0.25);
  float tarScabs = smoothstep(0.58, 0.9, sludge * 0.44 + fineSlime * 0.28 + ridges * 0.2);
  float veinGlow = smoothstep(0.4, 0.78, veins * 0.6 + caustics * 0.2 + murkBands * 0.14);
  float foam = smoothstep(0.64, 0.92, fineSlime * 0.46 + lakeEdges * 0.4 + caustics * 0.12);
  float vents = smoothstep(0.76, 0.95, (1.0 - smallCells) * 0.44 + fineSlime * 0.28 + veins * 0.18);

  vec3 deepBog = mix(u_base_color, vec3(0.006, 0.09, 0.046), 0.72);
  vec3 bruisedGreen = mix(u_base_color, vec3(0.03, 0.22, 0.08), 0.46);
  vec3 slick = mix(u_base_color, vec3(0.18, 0.66, 0.18), 0.28);
  vec3 acid = vec3(0.72, 1.0, 0.22);
  vec3 hotAcid = vec3(0.92, 1.0, 0.46);
  vec3 cyanScum = vec3(0.14, 0.95, 0.62);
  vec3 pinkSpores = vec3(1.0, 0.28, 0.72);

  vec3 color = mix(deepBog, bruisedGreen, continents * 0.62 + murkBands * 0.14);
  color = mix(color, slick, swamp * 0.28 + crustRot * 0.18);
  color = mix(color, vec3(0.004, 0.045, 0.024), tarScabs * 0.42);
  color = mix(color, acid, acidLakes * 0.62 + veinGlow * 0.2);
  color = mix(color, hotAcid, bloomedPools * 0.34 + foam * 0.22);
  color = mix(color, cyanScum, caustics * acidLakes * 0.18 + foam * 0.13);
  color += pinkSpores * vents * 0.12;
  color += acid * veinGlow * 0.08;

  vec3 lightDirection = normalize(vec3(-0.44, 0.58, 0.69));
  float diffuse = clamp(dot(normal, lightDirection), 0.0, 1.0);
  float day = smoothstep(-0.32, 0.5, dot(normal, lightDirection));
  float limb = 1.0 - clamp(normal.z, 0.0, 1.0);
  color *= 0.44 + diffuse * 0.74;
  color = mix(color * 0.36, color, day);
  color += (acid * acidLakes + hotAcid * veinGlow + cyanScum * foam) * (0.1 + (1.0 - day) * 0.14);
  color += tint(u_base_color, 0.6) * pow(limb, 2.1) * 0.09 * day;

  return vec4(color, 1.0);
}

void main() {
  vec2 pixel = gl_FragCoord.xy - vec2(0.5);
  vec2 center = u_texture_size * 0.5;
  vec2 planetPosition = (pixel - center) / max(u_radius, 1.0);
  planetPosition.y *= -1.0;

  float distanceFromCenter = length(planetPosition);
  float bodyAlpha = 1.0 - smoothstep(0.992, 1.006, distanceFromCenter);
  float outerGlow = smoothstep(0.98, 1.02, distanceFromCenter) *
    (1.0 - smoothstep(1.0, 1.4, distanceFromCenter));
  float atmosphere = smoothstep(0.64, 0.98, distanceFromCenter) *
    (1.0 - smoothstep(0.98, 1.27, distanceFromCenter));

  if (distanceFromCenter > 1.4) {
    discard;
  }

  vec3 glowColor = mix(u_base_color, vec3(0.78, 1.0, 0.2), 0.58);
  vec3 color = glowColor * outerGlow * 0.2;
  float alpha = outerGlow * 0.38 + atmosphere * 0.16;

  if (bodyAlpha > 0.0) {
    float z = sqrt(max(0.0, 1.0 - distanceFromCenter * distanceFromCenter));
    vec3 normal = normalize(vec3(planetPosition.x, planetPosition.y, z));
    vec2 sphereUv = vec2(
      atan(normal.x, normal.z) / TAU + 0.5,
      asin(clamp(normal.y, -1.0, 1.0)) / PI + 0.5
    );
    vec4 surface = sampleToxicSurface(sphereUv, normal);

    float rim = smoothstep(0.68, 1.0, distanceFromCenter) * bodyAlpha;
    float outline = smoothstep(0.982, 1.0, distanceFromCenter) * bodyAlpha;
    vec3 rimColor = tint(u_base_color, 0.72);
    vec3 outlined = mix(surface.rgb, vec3(0.0, 0.032, 0.018), outline * 0.62);
    outlined += rimColor * rim * 0.18;

    vec2 hazeOffset = planetPosition - vec2(-0.08, 0.04);
    float haze = (1.0 - smoothstep(0.18, 0.96, length(hazeOffset))) * bodyAlpha;
    outlined += vec3(0.74, 1.0, 0.26) * haze * 0.025;

    color = mix(color, outlined, bodyAlpha);
    alpha = max(alpha, bodyAlpha);
  }

  if (alpha <= VISIBLE_ALPHA_THRESHOLD) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
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
