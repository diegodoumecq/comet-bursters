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

uniform float u_arm_count;
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

void main() {
  vec2 uv = gl_FragCoord.xy / u_texture_size.xy;
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= u_texture_size.x / u_texture_size.y;

  float tilt = -0.22;
  float s = sin(tilt);
  float c = cos(tilt);
  vec2 tilted = mat2(c, -s, s, c) * centered;
  tilted.y *= 1.42;

  float radius = length(tilted);
  float angle = atan(tilted.y, tilted.x);
  vec3 seedOffset = vec3(u_seed * 0.013, u_seed * 0.021, u_seed * 0.034);
  vec3 basePosition = vec3(tilted * 2.8, radius * 2.1) + seedOffset;
  float broadWarp = fbm(basePosition * 0.62 + vec3(1.7, 5.9, 8.3));
  float shearWarp = fbm(basePosition * 1.14 + vec3(9.1, 2.6, 4.4));
  vec2 curl = curlWarp(basePosition * 0.74 + vec3(2.4, 6.1, 9.7));
  vec2 warped = tilted + curl * (0.16 + (1.0 - smoothstep(0.0, 1.25, radius)) * 0.15);
  float warpedRadius = length(warped);
  float warpedAngle = atan(warped.y, warped.x);

  float spiralPhase =
    warpedAngle * u_arm_count -
    log(max(warpedRadius, 0.018)) * 5.8 +
    broadWarp * 2.6 +
    shearWarp * 0.8;
  float armWave = cos(spiralPhase);
  float broadArms = smoothstep(0.15, 0.94, armWave);
  float thinArms = smoothstep(0.76, 0.99, armWave + ridgedFbm(basePosition * 4.8) * 0.22);
  float armFalloff = exp(-warpedRadius * 1.55) * (1.0 - smoothstep(1.03, 1.45, warpedRadius));
  float turbulentDust = billowFbm(vec3(warped * 8.0, u_seed * 0.041) + broadWarp * 1.4);
  float filamentNoise = ridgedFbm(vec3(warped * 18.0, u_seed * 0.083) + vec3(curl, shearWarp));
  float armDensity = clamp((broadArms * 0.72 + thinArms * 0.48) * armFalloff, 0.0, 1.0);
  armDensity *= smoothstep(0.09, 0.96, turbulentDust + filamentNoise * 0.24);

  float core = exp(-dot(tilted / vec2(0.26, 0.2), tilted / vec2(0.26, 0.2)));
  float coreHalo = exp(-radius * 2.6);
  float dustLaneWave = sin(spiralPhase + PI * 0.54 + turbulentDust * 1.6);
  float dustLanes = smoothstep(0.46, 0.94, dustLaneWave) * armFalloff;
  dustLanes *= smoothstep(0.18, 1.0, warpedRadius) * smoothstep(0.18, 0.9, filamentNoise + turbulentDust * 0.28);

  float clusterField = smoothstep(0.48, 0.92, ridgedFbm(vec3(warped * 11.0, u_seed * 0.067)));
  float blueClusters = armDensity * clusterField * smoothstep(0.22, 0.86, warpedRadius);
  float goldenKnots = thinArms * smoothstep(0.58, 0.94, fbm(vec3(warped * 22.0, u_seed * 0.097))) * armFalloff;

  vec3 color = u_space_color;
  color += u_arm_color * armDensity * 0.88;
  color += u_cluster_color * blueClusters * 0.82;
  color += u_dust_color * dustLanes * 0.36;
  color += u_core_color * (core * 1.45 + coreHalo * 0.24 + goldenKnots * 0.22);
  color *= 1.0 - dustLanes * 0.18;

  float starA = starLayer(uv, 96.0, 0.975, 0.55);
  float starB = starLayer(uv + vec2(0.37, 0.19), 168.0, 0.985, 0.42);
  float starC = starLayer(uv + vec2(0.11, 0.73), 320.0, 0.992, 0.32);
  float galaxyMask = smoothstep(0.15, 0.95, armDensity + core * 0.6);
  vec3 starColor = mix(vec3(0.62, 0.78, 1.0), vec3(1.0, 0.86, 0.62), hash21(uv * 120.0 + u_seed));
  color += starColor * (starA + starB + starC) * (1.0 - galaxyMask * 0.36);

  float vignette = smoothstep(1.42, 0.12, length(centered));
  color *= 0.36 + vignette * 0.82;
  color = pow(max(color, vec3(0.0)), vec3(0.86));

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createSpiralGalaxyShaderTexture(
  scene: Phaser.Scene,
  textureKey: string,
  textureSize: number,
): boolean {
  return createShaderTexture(scene, textureKey, fragmentShader, textureSize, (gl, program) => {
    setFloatUniform(gl, program, 'u_arm_count', 4);
    setFloatUniform(gl, program, 'u_seed', 908.173);
    setVec2Uniform(gl, program, 'u_texture_size', textureSize, textureSize);
    setVec3Uniform(gl, program, 'u_core_color', hexToVec3Uniform('#ffd48a'));
    setVec3Uniform(gl, program, 'u_arm_color', hexToVec3Uniform('#b9c8ff'));
    setVec3Uniform(gl, program, 'u_dust_color', hexToVec3Uniform('#a5476d'));
    setVec3Uniform(gl, program, 'u_cluster_color', hexToVec3Uniform('#61d8ff'));
    setVec3Uniform(gl, program, 'u_space_color', hexToVec3Uniform('#02030a'));
  });
}
