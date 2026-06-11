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
  float amplitude = 0.52;
  for (int i = 0; i < 6; i++) {
    value += valueNoise(p) * amplitude;
    p = mat3(
      0.78, -0.42, 0.47,
      0.54, 0.84, -0.08,
      -0.31, 0.32, 0.89
    ) * p * 2.03 + vec3(5.7, 2.4, 8.6);
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
      0.48, -0.82, 0.31,
      0.87, 0.44, -0.22,
      0.04, 0.38, 0.92
    ) * p * 1.86 + vec3(3.2, 7.9, 1.6);
    amplitude *= 0.55;
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

vec2 curlWarp(vec3 p) {
  float left = valueNoise(p + vec3(-0.31, 0.0, 0.0));
  float right = valueNoise(p + vec3(0.31, 0.0, 0.0));
  float down = valueNoise(p + vec3(0.0, -0.31, 0.0));
  float up = valueNoise(p + vec3(0.0, 0.31, 0.0));
  vec2 broad = vec2(up - down, left - right);
  vec2 detail = vec2(
    valueNoise(p * 2.2 + vec3(4.1, 8.7, 2.3)) - 0.5,
    valueNoise(p * 2.4 + vec3(7.6, 1.9, 6.4)) - 0.5
  );
  return broad + detail * 0.32;
}

vec2 swirlPoint(vec2 uv, vec2 center, vec2 radius, float strength, float rotation) {
  vec2 delta = uv - center;
  float distanceToOval = length(delta / radius);
  float falloff = 1.0 - smoothstep(0.0, 1.35, distanceToOval);
  float angle = strength * falloff + rotation;
  float s = sin(angle);
  float c = cos(angle);
  return center + mat2(c, -s, s, c) * delta;
}

float stormSwirlField(vec2 uv, vec2 center, vec2 radius, float rotation, float swirlNoise) {
  vec2 delta = uv - center;
  float s = sin(rotation);
  float c = cos(rotation);
  vec2 rotated = mat2(c, -s, s, c) * delta;
  float distanceToOval = length(rotated / radius);
  float falloff = 1.0 - smoothstep(0.45, 1.2, distanceToOval);
  float spiral = sin(atan(rotated.y, rotated.x) * 2.0 + distanceToOval * 5.4 + swirlNoise * 2.2) * 0.5 + 0.5;
  return falloff * (0.55 + spiral * 0.45);
}

float gasSwirlLayer(vec2 uv, vec2 center, vec2 radius, float rotation, float turn, float noise) {
  vec2 delta = uv - center;
  float s = sin(rotation);
  float c = cos(rotation);
  vec2 rotated = mat2(c, -s, s, c) * delta;
  float distanceToOval = length(rotated / radius);
  float falloff = 1.0 - smoothstep(0.25, 1.34, distanceToOval);
  float angle = atan(rotated.y / radius.y, rotated.x / radius.x);
  float spiral = sin(angle * 2.6 + distanceToOval * turn + noise * 3.2);
  float strands = sin(rotated.x / radius.x * 7.0 + spiral * 1.2 + noise * 2.4) * 0.5 + 0.5;
  return falloff * smoothstep(0.26, 0.88, strands);
}

vec3 tint(vec3 color, float amount) {
  if (amount >= 0.0) {
    return mix(vec3(0.28, 0.16, 0.52), vec3(0.86, 0.76, 1.0), amount);
  }
  return mix(color, vec3(0.075, 0.045, 0.16), abs(amount));
}

vec4 sampleGasSurface(vec2 sphereUv, vec3 normal) {
  vec3 rotatedNormal = rotateY(u_rotation) * normal;
  vec3 seedOffset = vec3(u_seed * 0.013, u_seed * 0.021, u_seed * 0.017);
  vec3 cloudPosition = rotatedNormal * vec3(3.1, 9.4, 3.4) + seedOffset;
  float broadWarp = fbm(cloudPosition * 0.42 + vec3(1.7, 5.9, 8.3));
  float shearWarp = fbm(cloudPosition * 1.08 + vec3(9.1, 2.6, 4.4));
  float billows = billowFbm(cloudPosition * 0.72 + vec3(4.2, 8.6, 1.5));
  vec2 curl = curlWarp(cloudPosition * 0.72 + vec3(2.4, 6.1, 9.7));
  vec3 warpedNormal = rotatedNormal + vec3(curl * 0.16, (broadWarp - 0.5) * 0.09);
  float turbulentWisps = fbm(warpedNormal * 9.2 + vec3(shearWarp * 3.1, u_seed * 0.011, broadWarp * 2.2));
  float fineCloud = billowFbm(warpedNormal * 18.0 + vec3(7.5, 1.8, 5.2) + turbulentWisps * 1.4);
  float ridgeStreaks = ridgedFbm(warpedNormal * 5.8 + vec3(2.9, 7.1, 4.6) + vec3(curl, shearWarp) * 1.2);
  float laceNoise = ridgedFbm(warpedNormal * 14.0 + vec3(8.4, 0.9, 6.3) + fineCloud * 0.85);
  float cellularPockets = cellular(warpedNormal * 3.6 + vec3(6.5, 1.2, 8.7) + billows * 0.72);

  float latitude = sphereUv.y;
  vec2 swirledUv = sphereUv;
  swirledUv = swirlPoint(swirledUv, vec2(0.57, 0.59), vec2(0.19, 0.082), 2.5 + broadWarp * 1.2, -0.2);
  swirledUv = swirlPoint(swirledUv, vec2(0.36, 0.43), vec2(0.12, 0.052), -1.8 - shearWarp * 0.8, 0.34);
  swirledUv += curl * vec2(0.028, 0.018);

  vec2 stormDelta = swirledUv - vec2(0.57, 0.59);
  float stormFalloff = exp(-dot(stormDelta / vec2(0.22, 0.1), stormDelta / vec2(0.22, 0.1)));
  float stormSwirl =
    sin(atan(stormDelta.y, stormDelta.x) * 2.0 + length(stormDelta * vec2(9.0, 15.0)) - broadWarp * 4.0 + ridgeStreaks * 1.3) *
    stormFalloff;
  vec2 secondaryDelta = swirledUv - vec2(0.36, 0.43);
  float secondaryFalloff = exp(-dot(secondaryDelta / vec2(0.14, 0.064), secondaryDelta / vec2(0.14, 0.064)));
  float secondarySwirl =
    sin(atan(secondaryDelta.y, secondaryDelta.x) * -3.0 + length(secondaryDelta * vec2(14.0, 24.0)) + laceNoise * 2.0) *
    secondaryFalloff;
  float gasSwirlNoise = fbm(vec3(swirledUv * vec2(7.0, 11.0), u_seed * 0.101) + warpedNormal * 1.3);
  float upperGasSwirl = gasSwirlLayer(swirledUv, vec2(0.28, 0.63), vec2(0.34, 0.075), -0.1, 8.6, gasSwirlNoise);
  float midGasSwirl = gasSwirlLayer(swirledUv, vec2(0.63, 0.48), vec2(0.42, 0.09), 0.08, -7.2, gasSwirlNoise + shearWarp);
  float lowerGasSwirl = gasSwirlLayer(swirledUv, vec2(0.38, 0.34), vec2(0.28, 0.062), -0.18, 9.4, gasSwirlNoise + broadWarp);
  float gasSwirls = clamp(upperGasSwirl * 0.52 + midGasSwirl * 0.62 + lowerGasSwirl * 0.48, 0.0, 1.0);
  float longitudinalFlow =
    swirledUv.x +
    (shearWarp - 0.5) * 0.13 +
    curl.x * 0.065 +
    sin((latitude * 4.8 + broadWarp * 0.7) * TAU) * 0.025 +
    stormSwirl * 0.09 +
    secondarySwirl * 0.055 +
    gasSwirls * 0.052;
  float bandCoord =
    swirledUv.y +
    (broadWarp - 0.5) * 0.09 +
    (billows - 0.5) * 0.05 +
    curl.y * 0.045 +
    sin((longitudinalFlow * 2.0 + shearWarp * 0.45) * TAU) * 0.022 +
    stormSwirl * 0.036 +
    secondarySwirl * 0.025 +
    (upperGasSwirl - lowerGasSwirl) * 0.018;
  float broadBelts =
    sin((bandCoord * 5.6 + sin(longitudinalFlow * TAU * 1.35) * 0.15 + turbulentWisps * 0.18 + ridgeStreaks * 0.12) * TAU) * 0.5 + 0.5;
  float tightBelts =
    sin((bandCoord * 13.0 - broadWarp * 0.24 + sin(longitudinalFlow * TAU * 2.7 + curl.x) * 0.1 + laceNoise * 0.06) * TAU) * 0.5 + 0.5;
  float razorBands = sin((bandCoord * 25.0 + fineCloud * 0.2 + stormSwirl * 0.16 + ridgeStreaks * 0.1) * TAU) * 0.5 + 0.5;
  float beltNoise = fbm(vec3(longitudinalFlow * 3.6, bandCoord * 13.0, u_seed * 0.027));
  float widthNoise = fbm(vec3(longitudinalFlow * 1.4 + 8.0, bandCoord * 5.2, u_seed * 0.041));
  float zoneNoise = billowFbm(vec3(longitudinalFlow * 2.1, bandCoord * 7.0 + 3.0, u_seed * 0.033));
  float brokenFlow = smoothstep(
    0.26,
    0.76,
    fbm(vec3(longitudinalFlow * 8.0 + curl.x * 1.8, bandCoord * 3.6 + curl.y, u_seed * 0.049)) + laceNoise * 0.08
  );
  float ovalPocketMask = smoothstep(0.28, 0.78, cellularPockets * 1.6 + secondaryFalloff * 0.12);

  float wideBeltThreshold = mix(0.34, 0.68, widthNoise);
  float narrowBeltThreshold = mix(0.56, 0.86, zoneNoise);
  float broadBeltMask = smoothstep(wideBeltThreshold - 0.22, wideBeltThreshold + 0.18, broadBelts);
  float narrowBeltMask = smoothstep(narrowBeltThreshold - 0.08, narrowBeltThreshold + 0.07, tightBelts);
  float wispMask = smoothstep(0.7, 0.94, razorBands + fineCloud * 0.2 + laceNoise * 0.1) * brokenFlow;
  float mergedZoneMask = smoothstep(
    0.34,
    0.84,
    (1.0 - broadBelts) * 0.45 + billows * 0.32 + zoneNoise * 0.16 + ovalPocketMask * 0.12
  );

  float darkBelts = smoothstep(
    0.32,
    0.9,
    broadBeltMask * 0.4 + narrowBeltMask * 0.2 + beltNoise * 0.16 + ridgeStreaks * 0.12 + (1.0 - brokenFlow) * 0.1
  );
  float brightZones = smoothstep(0.42, 0.94, mergedZoneMask * 0.44 + billows * 0.2 + wispMask * 0.16 + laceNoise * 0.07);
  float copperBands = smoothstep(
    0.5,
    0.94,
    narrowBeltMask * 0.22 + turbulentWisps * 0.18 + widthNoise * 0.13 + ovalPocketMask * 0.1 + (1.0 - abs(latitude - 0.54) * 2.0) * 0.12
  );
  float blueHollows = smoothstep(0.54, 0.94, darkBelts * 0.22 + fineCloud * 0.2 + shearWarp * 0.12 + zoneNoise * 0.1 + cellularPockets * 0.16);
  float highClouds = smoothstep(0.52, 0.92, billows * 0.24 + fineCloud * 0.16 + brightZones * 0.16 + wispMask * 0.17 + laceNoise * 0.07);
  float coolFilaments = smoothstep(
    0.5,
    0.9,
    ridgedFbm(
      warpedNormal * 24.0 +
        vec3(longitudinalFlow * 2.2 + curl.x * 0.8, bandCoord * 6.0 + curl.y * 1.4, u_seed * 0.057)
    ) +
      fineCloud * 0.1
  ) * brokenFlow;
  float shadowFilaments = smoothstep(
    0.56,
    0.94,
    ridgedFbm(warpedNormal * 31.0 + vec3(5.1, u_seed * 0.019, 2.6)) + (1.0 - brokenFlow) * 0.12
  ) * (0.24 + darkBelts * 0.3);
  float veilBillows = billowFbm(
    warpedNormal * 6.2 + vec3(longitudinalFlow * 1.6, bandCoord * 2.4, u_seed * 0.071)
  );
  float veilRidges = ridgedFbm(
    warpedNormal * 11.5 + vec3(broadWarp * 2.0 + curl.x, shearWarp * 1.5 + curl.y, u_seed * 0.083)
  );
  float veilPockets =
    1.0 -
    smoothstep(
      0.16,
      0.48,
      cellular(warpedNormal * 4.8 + vec3(shearWarp * 2.4, broadWarp * 1.6, u_seed * 0.067))
    );
  float cohesionVeil = smoothstep(
    0.38,
    0.84,
    veilBillows * 0.42 + veilRidges * 0.32 + veilPockets * 0.12 + brokenFlow * 0.08 + gasSwirls * 0.08
  );
  float microShear = smoothstep(
    0.46,
    0.9,
    fbm(vec3(longitudinalFlow * 18.0 + curl.x * 2.0, bandCoord * 32.0 + curl.y * 1.6, u_seed * 0.091)) * 0.5 +
      ridgedFbm(warpedNormal * 38.0 + vec3(1.8, 5.4, u_seed * 0.029)) * 0.34 +
      billowFbm(warpedNormal * 21.0 + vec3(6.2, u_seed * 0.037, 3.1)) * 0.16
  );
  float unityMistBroad = fbm(
    warpedNormal * 2.8 + vec3(longitudinalFlow * 0.9, bandCoord * 1.5, u_seed * 0.113)
  );
  float unityMistBillow = billowFbm(
    warpedNormal * 4.8 + vec3(shearWarp * 1.2, broadWarp * 1.4, u_seed * 0.127)
  );
  float unityMistThread = ridgedFbm(
    warpedNormal * 13.0 + vec3(longitudinalFlow * 3.2 + gasSwirls, bandCoord * 7.0, u_seed * 0.139)
  );
  float unityMist = smoothstep(
    0.34,
    0.86,
    unityMistBroad * 0.42 + unityMistBillow * 0.34 + unityMistThread * 0.12 + cohesionVeil * 0.12
  );

  float stormNoise = billowFbm(warpedNormal * 14.0 + vec3(7.2, 3.4, 8.8));
  float stormMask = stormSwirlField(swirledUv, vec2(0.57, 0.59), vec2(0.13, 0.058), -0.18, stormNoise);
  float secondaryStormMask = stormSwirlField(swirledUv, vec2(0.36, 0.43), vec2(0.075, 0.034), 0.42, laceNoise);

  float cloudContamination = clamp(darkBelts * 0.18 + blueHollows * 0.14 + turbulentWisps * 0.1 + ridgeStreaks * 0.08, 0.0, 0.36);
  float zoneFeather = clamp(1.0 - darkBelts * 0.22 - narrowBeltMask * 0.12, 0.62, 1.0);

  vec3 pearl = vec3(0.78, 0.72, 0.93);
  vec3 amethyst = vec3(0.56, 0.39, 0.78);
  vec3 lilacHaze = vec3(0.5, 0.41, 0.7);
  vec3 violetSmoke = vec3(0.32, 0.24, 0.48);
  vec3 plum = vec3(0.27, 0.19, 0.4);
  vec3 deepViolet = vec3(0.2, 0.15, 0.33);
  vec3 blueViolet = vec3(0.34, 0.31, 0.56);
  vec3 ionBlue = vec3(0.3, 0.36, 0.62);
  vec3 integratedPearl = mix(pearl, mix(amethyst, ionBlue, blueHollows * 0.34), cloudContamination);

  vec3 color = mix(violetSmoke, deepViolet, darkBelts * 0.18);
  color = mix(color, amethyst, turbulentWisps * 0.18 + copperBands * 0.1);
  color = mix(color, integratedPearl, (brightZones * 0.34 + highClouds * 0.16) * zoneFeather);
  color = mix(color, lilacHaze, copperBands * 0.08 + ovalPocketMask * 0.055 + secondaryStormMask * 0.04);
  color = mix(color, plum, darkBelts * copperBands * 0.05 + stormMask * 0.04 + shadowFilaments * 0.045);
  color = mix(color, blueViolet, blueHollows * 0.14 + coolFilaments * 0.045);
  color = mix(color, ionBlue, coolFilaments * blueHollows * 0.05);
  color = mix(color, lilacHaze, gasSwirls * (0.065 + brightZones * 0.035));
  color = mix(color, deepViolet, gasSwirls * darkBelts * 0.02);
  color = mix(color, mix(lilacHaze, blueViolet, blueHollows * 0.42 + coolFilaments * 0.22), cohesionVeil * 0.08);
  color = mix(color, deepViolet, cohesionVeil * shadowFilaments * 0.018);
  color += vec3(0.08, 0.065, 0.16) * (turbulentWisps * 0.05 + ridgeStreaks * 0.032 + coolFilaments * 0.04);
  color += vec3(0.065, 0.06, 0.14) * microShear * cohesionVeil * 0.038;
  color = mix(color, plum, microShear * shadowFilaments * 0.012);
  color += vec3(0.06, 0.04, 0.13) * (stormMask + secondaryStormMask) * stormNoise * 0.026;
  color = mix(color, pearl, (1.0 - darkBelts) * cohesionVeil * 0.035);
  color = mix(color, mix(lilacHaze, pearl, brightZones * 0.28 + highClouds * 0.12), unityMist * 0.052);
  color = mix(color, mix(violetSmoke, blueViolet, cohesionVeil * 0.55), unityMist * darkBelts * 0.034);
  color += vec3(0.045, 0.04, 0.095) * unityMistThread * unityMist * 0.026;

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
  vec4 surface = sampleGasSurface(sphereUv, normal);

  gl_FragColor = vec4(surface.rgb, bodyAlpha);
}
`;

export function createGasPlanetShaderTexture(
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
      setFloatUniform(gl, program, 'u_seed', getPlanetShaderSeed(planet) + 31.41);
      setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
    },
  );
}
