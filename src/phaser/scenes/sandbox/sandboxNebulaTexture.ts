import Phaser from 'phaser';

import { createShaderTexture, setVec2Uniform } from '../../core/shaderTextures';

export const SANDBOX_NEBULA_TEXTURE_SIZE = 1536;

const SEED = 37.171;

const fragmentShader = `
precision highp float;

uniform vec2 u_texture_size;

const float TAU = 6.28318530718;
const float SEED = ${SEED.toFixed(3)};

float positiveModulo(float value, float divisor) {
  return mod(mod(value, divisor) + divisor, divisor);
}

float hashGrid(float x, float y, float periodX, float periodY) {
  float wrappedX = positiveModulo(floor(x), periodX);
  float wrappedY = positiveModulo(floor(y), periodY);
  return mod(abs(sin((wrappedX + 1.0) * 127.1 + (wrappedY + 1.0) * 311.7 + SEED) * 43758.5453), 1.0);
}

float noisePeriodic(float x, float y, float periodX, float periodY) {
  float x0 = floor(x);
  float y0 = floor(y);
  float fx = x - x0;
  float fy = y - y0;
  float sx = fx * fx * (3.0 - 2.0 * fx);
  float sy = fy * fy * (3.0 - 2.0 * fy);
  float x1 = x0 + 1.0;
  float y1 = y0 + 1.0;
  float a = hashGrid(x0, y0, periodX, periodY);
  float b = hashGrid(x1, y0, periodX, periodY);
  float c = hashGrid(x0, y1, periodX, periodY);
  float d = hashGrid(x1, y1, periodX, periodY);
  return mix(mix(a, b, sx), mix(c, d, sx), sy);
}

float fbmPeriodic(float x, float y, float periodX, float periodY, int octaves) {
  float amplitude = 0.5;
  float frequency = 1.0;
  float total = 0.0;
  float normalization = 0.0;
  for (int octave = 0; octave < 5; octave++) {
    if (octave < octaves) {
      total += noisePeriodic(x * frequency, y * frequency, periodX * frequency, periodY * frequency) * amplitude;
      normalization += amplitude;
      amplitude *= 0.52;
      frequency *= 2.0;
    }
  }
  return normalization > 0.0 ? total / normalization : 0.0;
}

float clampByte(float value) {
  return clamp(floor(value + 0.5), 0.0, 255.0) / 255.0;
}

vec4 sampleNebula(float u, float v) {
  float warpX = fbmPeriodic(u * 4.0 + 1.7, v * 4.0 + 7.2, 4.0, 4.0, 4) - 0.5;
  float warpY = fbmPeriodic(u * 4.0 + 8.9, v * 4.0 + 2.4, 4.0, 4.0, 4) - 0.5;
  float ribbonA = sin((u * 3.0 + v * 2.0 + warpX * 0.85 + SEED * 0.03) * TAU) * 0.5 + 0.5;
  float ribbonB = cos((u * 2.0 - v * 4.0 + warpY * 0.75 + SEED * 0.05) * TAU) * 0.5 + 0.5;
  float curvedU = u + warpX * 0.11 + sin((u + v * 2.0) * TAU) * 0.012;
  float curvedV = v + warpY * 0.11 + cos((u * 2.0 - v) * TAU) * 0.012;
  float broad = fbmPeriodic(curvedU * 5.0, curvedV * 5.0, 5.0, 5.0, 5);
  float cloud = fbmPeriodic(curvedU * 10.0 + 3.3, curvedV * 10.0 + 5.7, 10.0, 10.0, 4);
  float detail = fbmPeriodic(curvedU * 28.0 + warpY * 2.6, curvedV * 28.0 - warpX * 2.6, 28.0, 28.0, 3);
  float colorNoise = fbmPeriodic(curvedU * 8.0 + 9.1, curvedV * 8.0 + 4.2, 8.0, 8.0, 3);
  float ridge = 1.0 - abs(detail * 2.0 - 1.0);
  float lane = smoothstep(0.58, 0.91, (1.0 - broad) * 0.52 + ribbonB * 0.22 + detail * 0.2);
  float mass = smoothstep(0.34, 0.86, broad * 0.54 + cloud * 0.34 + ridge * 0.12);
  float veil = smoothstep(0.28, 0.78, cloud * 0.46 + ribbonA * 0.28 + ridge * 0.16);
  float thread = smoothstep(0.75, 0.99, ridge * 0.62 + ribbonA * 0.18 + cloud * 0.12);
  float density = clamp(mass * 0.58 + veil * 0.22 + thread * 0.12 - lane * 0.32, 0.0, 1.0);
  vec3 cold = mix(vec3(34.0, 70.0, 148.0), vec3(58.0, 48.0, 130.0), colorNoise);
  vec3 warm = mix(vec3(92.0, 54.0, 136.0), vec3(28.0, 128.0, 146.0), cloud);
  vec3 gas = mix(cold, warm, smoothstep(0.28, 0.88, veil));
  vec3 pearl = vec3(158.0, 168.0, 190.0);
  vec3 highlight = mix(gas, pearl, thread * 0.18);
  float shade = 1.0 - lane * 0.42;
  float glow = density * 0.86 + thread * 0.12;

  return vec4(
    clampByte(highlight.r * glow * shade),
    clampByte(highlight.g * glow * shade),
    clampByte(highlight.b * glow * shade),
    clampByte(8.0 + density * 90.0 + veil * 30.0 + thread * 18.0)
  );
}

void main() {
  float u = floor(gl_FragCoord.x) / u_texture_size.x;
  float v = floor(u_texture_size.y - gl_FragCoord.y) / u_texture_size.y;
  gl_FragColor = sampleNebula(u, v);
}
`;

export function createSandboxNebulaTexture(scene: Phaser.Scene, textureKey: string): void {
  if (scene.textures.exists(textureKey)) return;

  const created = createShaderTexture(
    scene,
    textureKey,
    fragmentShader,
    SANDBOX_NEBULA_TEXTURE_SIZE,
    (gl, program) => {
      setVec2Uniform(
        gl,
        program,
        'u_texture_size',
        SANDBOX_NEBULA_TEXTURE_SIZE,
        SANDBOX_NEBULA_TEXTURE_SIZE,
      );
    },
  );
  if (!created) createBlankTexture(scene, textureKey);
}

function createBlankTexture(scene: Phaser.Scene, textureKey: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = SANDBOX_NEBULA_TEXTURE_SIZE;
  canvas.height = SANDBOX_NEBULA_TEXTURE_SIZE;
  scene.textures.addCanvas(textureKey, canvas);
}
