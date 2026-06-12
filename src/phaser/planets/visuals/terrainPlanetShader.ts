import Phaser from 'phaser';

import type { PlanetEntity, PlanetKind } from '../types';
import {
  createPlanetShaderTexture,
  getPlanetShaderSeed,
  hexToVec3Uniform,
  setFloatUniform,
  setVec2Uniform,
  setVec3Uniform,
  type Vec3Uniform,
} from './planetShaderTexture';

type TerrainPlanetKind = Extract<PlanetKind, 'crystal' | 'desert' | 'ice' | 'lush'>;

const VISIBLE_ALPHA_THRESHOLD = 0.003;

const fragmentShader = `
precision highp float;

uniform float u_radius;
uniform float u_rotation;
uniform float u_seed;
uniform float u_style;
uniform vec2 u_texture_size;
uniform vec3 u_base_color;
uniform vec3 u_secondary_color;
uniform vec3 u_accent_color;
uniform vec3 u_palette_shadow_color;
uniform vec3 u_palette_base_color;
uniform vec3 u_palette_mid_color;
uniform vec3 u_palette_light_color;
uniform vec3 u_palette_accent_color;
uniform vec3 u_palette_ink_color;

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
  float amplitude = 0.52;
  for (int i = 0; i < 6; i++) {
    value += valueNoise(p) * amplitude;
    p = mat3(
      0.78, -0.48, 0.39,
      0.57, 0.80, -0.18,
      -0.25, 0.36, 0.90
    ) * p * 2.05 + vec3(6.7, 3.1, 8.4);
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
    ) * p * 2.28 + vec3(3.7, 8.8, 1.9);
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

float cellular(vec3 p) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  float nearest = 10.0;
  float secondNearest = 10.0;

  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 offset = vec3(float(x), float(y), float(z));
        vec3 point = offset + hash33(cell + offset);
        float distanceToPoint = length(point - local);
        if (distanceToPoint < nearest) {
          secondNearest = nearest;
          nearest = distanceToPoint;
        } else if (distanceToPoint < secondNearest) {
          secondNearest = distanceToPoint;
        }
      }
    }
  }

  return secondNearest - nearest;
}

float crackLayer(vec3 p, vec3 direction, float frequency, float phase, float width) {
  vec3 dir = normalize(direction);
  float warp = fbm(p * 0.56 + dir * 2.2 + vec3(phase)) * 1.1 + ridgedFbm(p * 0.38 - vec3(phase)) * 0.7;
  float line = sin(dot(p, dir) * frequency + warp * 2.4 + phase);
  return 1.0 - smoothstep(width, width * 3.0, abs(line));
}

float crackNetwork(vec3 p) {
  float broad =
    crackLayer(p, vec3(1.0, 0.14, -0.52), 8.4, u_seed * 0.031, 0.08) * 0.36 +
    crackLayer(p, vec3(-0.24, 1.0, 0.44), 10.2, u_seed * 0.047 + 1.4, 0.064) * 0.3 +
    crackLayer(p, vec3(0.4, -0.46, 1.0), 12.6, u_seed * 0.023 + 2.6, 0.052) * 0.24;
  float fine =
    crackLayer(p, vec3(0.82, -0.56, 0.24), 22.0, u_seed * 0.019 + 0.6, 0.026) * 0.2 +
    crackLayer(p, vec3(-0.43, 0.38, 1.0), 27.0, u_seed * 0.041 + 0.8, 0.022) * 0.18;
  return clamp(broad + fine, 0.0, 1.0);
}

vec3 tint(vec3 color, float amount) {
  vec3 target = amount >= 0.0 ? vec3(1.0) : vec3(0.02, 0.025, 0.035);
  return mix(color, target, abs(amount));
}

float waveRibbon(float wave, float width, float softness) {
  return 1.0 - smoothstep(width, width + softness, abs(wave));
}

float cartoonBandEdge(float band) {
  return smoothstep(0.22, 0.48, band) * (1.0 - smoothstep(0.62, 0.92, band));
}

vec4 sampleLushSurface(vec2 sphereUv, vec3 normal) {
  vec3 rotatedNormal = rotateY(u_rotation) * normal;
  vec3 seedOffset = vec3(u_seed * 0.017, u_seed * 0.023, u_seed * 0.013);
  vec3 basePosition = rotatedNormal * 2.85 + seedOffset;
  vec3 warp = vec3(
    fbm(basePosition * 0.7 + vec3(2.3, 8.1, 1.7)),
    fbm(basePosition * 0.86 + vec3(7.7, 2.6, 5.4)),
    billowFbm(basePosition * 0.62 + vec3(4.1, 5.3, 9.0))
  ) - 0.5;
  vec3 q = rotatedNormal * 3.7 + warp * 1.22 + seedOffset * 0.34;

  float slowWarp = fbm(q * 0.72 + vec3(1.6, 4.0, 7.2));
  float mediumWarp = billowFbm(q * 1.48 + warp * 0.86);
  float fineWarp = fbm(q * 6.2 + warp * 1.8 + vec3(3.7, 9.1, 1.2));

  float alongFlow = sphereUv.x + sphereUv.y * 0.18;
  float acrossFlow =
    sphereUv.y +
    sphereUv.x * 0.23 +
    sin((alongFlow * 2.2 + slowWarp * 0.32) * TAU) * 0.075 +
    sin((alongFlow * 5.1 - mediumWarp * 0.26 + u_seed * 0.003) * TAU) * 0.045 +
    (slowWarp - 0.5) * 0.045 +
    warp.x * 0.035;
  float secondaryAcross =
    sphereUv.y +
    sphereUv.x * 0.16 +
    sin((alongFlow * 3.0 + mediumWarp * 0.24 + 0.18) * TAU) * 0.07 +
    sin((alongFlow * 6.4 + fineWarp * 0.16) * TAU) * 0.032 +
    warp.y * 0.03;
  float tertiaryAcross =
    sphereUv.y +
    sphereUv.x * 0.2 +
    sin((alongFlow * 4.1 - slowWarp * 0.18 + 0.37) * TAU) * 0.058 +
    sin((alongFlow * 8.2 + mediumWarp * 0.12 + 0.61) * TAU) * 0.026 +
    warp.z * 0.026;

  float broadA = waveRibbon(sin((acrossFlow * 5.1 + 0.06) * TAU), 0.34, 0.2);
  float broadB = waveRibbon(sin((acrossFlow * 6.4 + 0.28) * TAU), 0.3, 0.18);
  float broadC = waveRibbon(sin((secondaryAcross * 8.2 + 0.47) * TAU), 0.26, 0.16);
  float broadD = waveRibbon(sin((acrossFlow * 10.4 + 0.66 + slowWarp * 0.08) * TAU), 0.2, 0.14);
  float broadE = waveRibbon(sin((tertiaryAcross * 12.6 + 0.18 + mediumWarp * 0.06) * TAU), 0.16, 0.12);
  float broadF = waveRibbon(sin((secondaryAcross * 15.2 + 0.78 + slowWarp * 0.05) * TAU), 0.14, 0.11);

  float fineA = waveRibbon(sin((acrossFlow * 18.0 + alongFlow * 0.42 + fineWarp * 0.12) * TAU), 0.065, 0.055);
  float fineB = waveRibbon(
    sin((secondaryAcross * 23.0 + alongFlow * 0.34 + mediumWarp * 0.12 + 0.2) * TAU),
    0.055,
    0.05
  );
  float fineC = waveRibbon(sin((acrossFlow * 31.0 + alongFlow * 0.28 + fineWarp * 0.16 + 0.56) * TAU), 0.045, 0.045);
  float fineD = waveRibbon(
    sin((tertiaryAcross * 38.0 + alongFlow * 0.22 + slowWarp * 0.13 + 0.35) * TAU),
    0.04,
    0.04
  );
  float fineE = waveRibbon(
    sin((secondaryAcross * 46.0 + alongFlow * 0.18 + fineWarp * 0.11 + 0.74) * TAU),
    0.034,
    0.036
  );

  float waveField = clamp(
    broadA * 0.28 + broadB * 0.24 + broadC * 0.2 + broadD * 0.16 + broadE * 0.13 + broadF * 0.11,
    0.0,
    1.0
  );
  float overlapGlow = clamp(
    broadA * broadB * 0.28 +
      broadB * broadC * 0.24 +
      broadC * broadD * 0.18 +
      broadD * broadE * 0.16 +
      broadE * broadF * 0.14,
    0.0,
    1.0
  );
  float vineField = clamp(fineA * 0.3 + fineB * 0.27 + fineC * 0.22 + fineD * 0.18 + fineE * 0.16, 0.0, 1.0);
  float waveFill = smoothstep(0.2, 0.24, waveField);
  float waveBright = smoothstep(0.48, 0.52, waveField);
  float wavePop = smoothstep(0.66, 0.7, waveField + overlapGlow * 0.32);
  float ribbonInk = clamp(
    cartoonBandEdge(broadA) * 0.34 +
      cartoonBandEdge(broadB) * 0.3 +
      cartoonBandEdge(broadC) * 0.26 +
      cartoonBandEdge(broadD) * 0.22 +
      cartoonBandEdge(broadE) * 0.2 +
      cartoonBandEdge(broadF) * 0.18,
    0.0,
    1.0
  );
  float shadowTroughs = smoothstep(
    0.4,
    0.78,
    (1.0 - waveFill) * 0.42 + ridgedFbm(q * 1.5 + vec3(8.1, 2.7, 4.3)) * 0.16
  );
  float luminousVeins = smoothstep(0.42, 0.7, vineField * 0.62 + overlapGlow * 0.12);
  float goldenMoss = smoothstep(
    0.48,
    0.76,
    broadC * fineA * 0.24 + broadD * fineB * 0.2 + broadF * fineE * 0.18 + overlapGlow * 0.18
  );

  vec3 color = u_palette_shadow_color;
  color = mix(color, u_palette_base_color, waveFill);
  color = mix(color, u_palette_mid_color, waveBright * 0.74);
  color = mix(color, u_palette_light_color, max(wavePop * 0.28, luminousVeins * 0.34));
  color = mix(color, u_palette_accent_color, goldenMoss * 0.24);
  color = mix(color, u_palette_ink_color, shadowTroughs * 0.16 + ribbonInk * 0.32);
  color += u_palette_light_color * luminousVeins * 0.035 + u_palette_accent_color * goldenMoss * 0.025;

  return vec4(color, 1.0);
}

vec4 sampleDesertSurface(vec2 sphereUv, vec3 normal) {
  vec3 rotatedNormal = rotateY(u_rotation) * normal;
  vec3 seedOffset = vec3(u_seed * 0.021, u_seed * 0.015, u_seed * 0.027);
  vec3 basePosition = rotatedNormal * vec3(3.2, 2.3, 3.5) + seedOffset;
  vec3 warp = vec3(
    fbm(basePosition * 0.78 + vec3(5.2, 2.1, 8.7)),
    ridgedFbm(basePosition * 0.62 + vec3(1.6, 7.4, 3.3)),
    fbm(basePosition * 1.06 + vec3(9.0, 4.1, 2.8))
  ) - 0.5;
  vec3 q = rotatedNormal * 4.0 + warp * 1.3 + seedOffset * 0.36;

  float dust = fbm(q * 0.7 + vec3(1.8, 6.2, 3.1));
  float ridges = ridgedFbm(q * 1.6 + warp * 0.9);
  float bakedClay = fbm(q * 3.2 + vec3(7.2, 1.9, 5.5));
  float grit = fbm(q * 12.0 + warp * 2.1);
  float cracks = crackNetwork(q * 1.24 + vec3(4.4, 8.8, 1.6));
  float rockCells = 1.0 - smoothstep(0.1, 0.34, cellular(q * 4.7 + warp * 1.1));

  float duneBands =
    sin((sphereUv.y * 8.6 + sphereUv.x * 1.9 + dust * 0.42 + warp.x * 0.2) * TAU) * 0.5 + 0.5;
  float crossDunes =
    sin((sphereUv.x * 5.4 - sphereUv.y * 3.7 + ridges * 0.7 + warp.y * 0.25) * TAU) * 0.5 + 0.5;
  float duneSignal = duneBands * 0.42 + crossDunes * 0.24 + ridges * 0.18 + dust * 0.12;
  float duneShadow = 1.0 - smoothstep(0.22, 0.34, duneSignal);
  float duneHighlight = smoothstep(0.62, 0.66, duneSignal);
  float duneCrest = smoothstep(0.78, 0.82, duneSignal + grit * 0.08);
  float duneInk = clamp(
    cartoonBandEdge(duneBands) * 0.4 + cartoonBandEdge(crossDunes) * 0.26 + cartoonBandEdge(ridges) * 0.22,
    0.0,
    1.0
  );
  duneInk = smoothstep(0.62, 0.86, duneInk);
  float clayPlates = smoothstep(0.52, 0.58, bakedClay * 0.34 + cracks * 0.26 + rockCells * 0.16);
  float clayPop = smoothstep(0.68, 0.72, bakedClay * 0.3 + rockCells * 0.28 + grit * 0.16);
  float crackInk = smoothstep(0.36, 0.52, cracks * 0.68 + ridges * 0.14);
  float pebblePop = smoothstep(0.76, 0.82, rockCells * 0.56 + grit * 0.24);

  vec3 color = u_palette_base_color;
  color = mix(color, u_palette_shadow_color, duneShadow * 0.34);
  color = mix(color, u_palette_light_color, duneHighlight * 0.44 + duneCrest * 0.22);
  color = mix(color, u_palette_mid_color, clayPlates * 0.4);
  color = mix(color, u_palette_accent_color, clayPop * 0.18 + pebblePop * 0.12);
  color = mix(color, u_palette_ink_color, duneInk * 0.025 + crackInk * 0.075);
  color += u_palette_light_color * duneCrest * 0.01;

  return vec4(color, 1.0);
}

vec4 sampleIceSurface(vec2 sphereUv, vec3 normal) {
  vec3 rotatedNormal = rotateY(u_rotation) * normal;
  vec3 seedOffset = vec3(u_seed * 0.019, u_seed * 0.025, u_seed * 0.014);
  vec3 basePosition = rotatedNormal * 3.35 + seedOffset;
  vec3 warp = vec3(
    billowFbm(basePosition * 0.76 + vec3(1.9, 7.4, 4.6)),
    fbm(basePosition * 0.96 + vec3(8.4, 2.8, 6.2)),
    ridgedFbm(basePosition * 0.58 + vec3(3.2, 5.9, 1.7))
  ) - 0.5;
  vec3 q = rotatedNormal * 4.6 + warp * 1.1 + seedOffset * 0.32;

  float frost = billowFbm(q * 0.84 + vec3(2.6, 8.1, 4.3));
  float glaciers = ridgedFbm(q * 1.55 + warp * 0.78);
  float blueIce = fbm(q * 2.7 + vec3(6.7, 1.5, 9.1));
  float snowDust = billowFbm(q * 7.4 + warp * 1.8);
  float fractures = crackNetwork(q * 1.08 + vec3(9.2, 4.7, 2.8));
  float floes = 1.0 - smoothstep(0.1, 0.4, cellular(q * 3.7 + warp));

  float polarGlow = smoothstep(0.2, 0.88, abs(sphereUv.y - 0.5) * 2.0 + frost * 0.12);
  float windBands =
    sin((sphereUv.y * 13.0 + sphereUv.x * 1.4 + snowDust * 0.22 + warp.x * 0.18) * TAU) * 0.5 + 0.5;
  float snowfields = smoothstep(0.42, 0.88, frost * 0.36 + snowDust * 0.26 + polarGlow * 0.22);
  float crevasses = smoothstep(0.46, 0.82, fractures * 0.58 + glaciers * 0.2 + windBands * 0.1);
  float cyanDepth = smoothstep(0.5, 0.88, blueIce * 0.38 + (1.0 - frost) * 0.2 + floes * 0.18);
  float sparkle = smoothstep(0.68, 0.95, snowDust * 0.42 + floes * 0.28 + glaciers * 0.1);

  vec3 deepBlue = mix(u_base_color, vec3(0.1, 0.36, 0.72), 0.42);
  vec3 iceBlue = mix(u_secondary_color, vec3(0.66, 0.95, 1.0), 0.34);
  vec3 snow = vec3(0.94, 0.98, 1.0);
  vec3 crackBlue = vec3(0.02, 0.22, 0.44);
  vec3 gleam = vec3(0.86, 1.0, 1.0);

  vec3 color = mix(deepBlue, iceBlue, frost * 0.6 + cyanDepth * 0.12);
  color = mix(color, snow, snowfields * 0.38);
  color = mix(color, crackBlue, crevasses * 0.24);
  color = mix(color, gleam, sparkle * 0.22);
  color += gleam * sparkle * 0.06;

  return vec4(color, 1.0);
}

vec4 sampleCrystalSurface(vec2 sphereUv, vec3 normal) {
  vec3 rotatedNormal = rotateY(u_rotation) * normal;
  vec3 seedOffset = vec3(u_seed * 0.024, u_seed * 0.018, u_seed * 0.03);
  vec3 q = rotatedNormal * 4.9 + seedOffset;
  vec3 warp = vec3(
    ridgedFbm(q * 0.52 + vec3(2.6, 7.3, 1.4)),
    fbm(q * 0.68 + vec3(8.8, 1.9, 5.2)),
    ridgedFbm(q * 0.44 + vec3(4.5, 6.1, 9.0))
  ) - 0.5;
  vec3 p = q + warp * 1.15;

  float facetsA = abs(sin(dot(p, normalize(vec3(1.0, 0.42, -0.3))) * 8.6 + u_seed * 0.03));
  float facetsB = abs(sin(dot(p, normalize(vec3(-0.38, 1.0, 0.62))) * 10.4 + u_seed * 0.05));
  float facetsC = abs(sin(dot(p, normalize(vec3(0.46, -0.54, 1.0))) * 12.0 + u_seed * 0.04));
  float facetPlanes = smoothstep(0.18, 0.62, min(min(facetsA, facetsB), facetsC));
  float prismNoise = ridgedFbm(p * 1.8 + warp * 0.8);
  float inclusions = fbm(p * 5.8 + vec3(6.2, 1.7, 8.1));
  float seams = crackNetwork(p * 1.2 + vec3(1.1, 9.3, 4.2));
  float sparkCells = 1.0 - smoothstep(0.08, 0.26, cellular(p * 6.4 + warp * 1.4));

  float arcBands =
    sin((sphereUv.y * 9.2 + sphereUv.x * 2.7 + prismNoise * 0.46 + warp.x * 0.16) * TAU) * 0.5 + 0.5;
  float brightPlanes = smoothstep(0.46, 0.88, facetPlanes * 0.38 + prismNoise * 0.3 + arcBands * 0.16);
  float innerGlow = smoothstep(0.54, 0.9, inclusions * 0.34 + (1.0 - facetPlanes) * 0.24 + sparkCells * 0.18);
  float edgeLines = smoothstep(0.4, 0.78, seams * 0.52 + (1.0 - facetPlanes) * 0.16);
  float glitter = smoothstep(0.7, 0.96, sparkCells * 0.5 + prismNoise * 0.22 + brightPlanes * 0.12);

  vec3 deep = mix(u_base_color, vec3(0.12, 0.18, 0.38), 0.28);
  vec3 glass = mix(u_secondary_color, vec3(0.72, 0.98, 1.0), 0.32);
  vec3 lavender = vec3(0.82, 0.66, 1.0);
  vec3 white = vec3(0.96, 1.0, 1.0);
  vec3 edge = vec3(0.08, 0.34, 0.56);

  vec3 color = mix(deep, glass, prismNoise * 0.54 + brightPlanes * 0.18);
  color = mix(color, lavender, innerGlow * 0.26);
  color = mix(color, edge, edgeLines * 0.18);
  color = mix(color, white, glitter * 0.28 + brightPlanes * 0.08);
  color += u_accent_color * innerGlow * 0.055 + white * glitter * 0.08;

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

  vec4 surface;
  if (u_style < 0.5) {
    surface = sampleLushSurface(sphereUv, normal);
  } else if (u_style < 1.5) {
    surface = sampleDesertSurface(sphereUv, normal);
  } else if (u_style < 2.5) {
    surface = sampleIceSurface(sphereUv, normal);
  } else {
    surface = sampleCrystalSurface(sphereUv, normal);
  }

  gl_FragColor = vec4(surface.rgb, bodyAlpha);
}
`;

type TerrainPlanetShaderStyle = {
  accentColor: Vec3Uniform;
  palette: {
    accent: Vec3Uniform;
    base: Vec3Uniform;
    ink: Vec3Uniform;
    light: Vec3Uniform;
    mid: Vec3Uniform;
    shadow: Vec3Uniform;
  };
  secondaryColor: Vec3Uniform;
  seedOffset: number;
  style: number;
};

const TERRAIN_PLANET_SHADER_STYLES: Record<TerrainPlanetKind, TerrainPlanetShaderStyle> = {
  lush: {
    accentColor: hexToVec3Uniform('#f0ff8a'),
    palette: {
      accent: hexToVec3Uniform('#c7ff42'),
      base: hexToVec3Uniform('#2e941f'),
      ink: hexToVec3Uniform('#001c0a'),
      light: hexToVec3Uniform('#8af257'),
      mid: hexToVec3Uniform('#33c543'),
      shadow: hexToVec3Uniform('#053812'),
    },
    secondaryColor: hexToVec3Uniform('#66d86f'),
    seedOffset: 3.41,
    style: 0,
  },
  desert: {
    accentColor: hexToVec3Uniform('#efb56a'),
    palette: {
      accent: hexToVec3Uniform('#b86633'),
      base: hexToVec3Uniform('#c28c40'),
      ink: hexToVec3Uniform('#5c381c'),
      light: hexToVec3Uniform('#e6ad57'),
      mid: hexToVec3Uniform('#9e572e'),
      shadow: hexToVec3Uniform('#8a5a2e'),
    },
    secondaryColor: hexToVec3Uniform('#e0a03c'),
    seedOffset: 11.29,
    style: 1,
  },
  ice: {
    accentColor: hexToVec3Uniform('#ffffff'),
    palette: {
      accent: hexToVec3Uniform('#ffffff'),
      base: hexToVec3Uniform('#87d8f5'),
      ink: hexToVec3Uniform('#06345a'),
      light: hexToVec3Uniform('#d7fbff'),
      mid: hexToVec3Uniform('#52b5e8'),
      shadow: hexToVec3Uniform('#185f9a'),
    },
    secondaryColor: hexToVec3Uniform('#b8f2ff'),
    seedOffset: 23.83,
    style: 2,
  },
  crystal: {
    accentColor: hexToVec3Uniform('#e8d6ff'),
    palette: {
      accent: hexToVec3Uniform('#e8d6ff'),
      base: hexToVec3Uniform('#8edff5'),
      ink: hexToVec3Uniform('#14578f'),
      light: hexToVec3Uniform('#f5ffff'),
      mid: hexToVec3Uniform('#a7ecff'),
      shadow: hexToVec3Uniform('#304069'),
    },
    secondaryColor: hexToVec3Uniform('#a7ecff'),
    seedOffset: 31.67,
    style: 3,
  },
};

export function createTerrainPlanetShaderTexture(
  scene: Phaser.Scene,
  textureKey: string,
  planet: PlanetEntity,
  textureSize: number,
  textureScale: number,
): boolean {
  if (!isTerrainPlanetKind(planet.kind)) return false;

  const style = TERRAIN_PLANET_SHADER_STYLES[planet.kind];
  return createPlanetShaderTexture(
    scene,
    textureKey,
    fragmentShader,
    textureSize,
    (gl, program) => {
      setVec3Uniform(gl, program, 'u_base_color', hexToVec3Uniform(planet.colorHex));
      setVec3Uniform(gl, program, 'u_secondary_color', style.secondaryColor);
      setVec3Uniform(gl, program, 'u_accent_color', style.accentColor);
      setVec3Uniform(gl, program, 'u_palette_shadow_color', style.palette.shadow);
      setVec3Uniform(gl, program, 'u_palette_base_color', style.palette.base);
      setVec3Uniform(gl, program, 'u_palette_mid_color', style.palette.mid);
      setVec3Uniform(gl, program, 'u_palette_light_color', style.palette.light);
      setVec3Uniform(gl, program, 'u_palette_accent_color', style.palette.accent);
      setVec3Uniform(gl, program, 'u_palette_ink_color', style.palette.ink);
      setFloatUniform(gl, program, 'u_radius', planet.radius * textureScale);
      setFloatUniform(gl, program, 'u_rotation', planet.rotation);
      setFloatUniform(gl, program, 'u_seed', getPlanetShaderSeed(planet) + style.seedOffset);
      setFloatUniform(gl, program, 'u_style', style.style);
      setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
    },
  );
}

function isTerrainPlanetKind(kind: PlanetKind): kind is TerrainPlanetKind {
  return kind === 'crystal' || kind === 'desert' || kind === 'ice' || kind === 'lush';
}
