export const nebulaNoiseShader = `
float hash(vec2 p) {
  p += u_seed;
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float noisePeriodic(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 wrapped = mod(i, period);
  return mix(
    mix(hash(wrapped), hash(mod(wrapped + vec2(1.0, 0.0), period)), u.x),
    mix(hash(mod(wrapped + vec2(0.0, 1.0), period)), hash(mod(wrapped + vec2(1.0, 1.0), period)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rotate = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    value += noise(p) * amplitude;
    p = rotate * p * 2.05 + 17.3;
    amplitude *= 0.52;
  }
  return value;
}

float fbmPeriodic(vec2 p, vec2 period) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 6; i++) {
    value += noisePeriodic(p, period) * amplitude;
    p = p * 2.0 + vec2(17.3, 9.7);
    period *= 2.0;
    amplitude *= 0.52;
  }
  return value;
}
`;

export const sandboxNebulaShader = `
vec4 sampleSandboxNebula(vec2 world01, float alphaScale) {
  vec2 p = world01 * 8.0;
  vec2 warp = vec2(
    fbmPeriodic(p + vec2(7.2, 1.9), vec2(8.0)),
    fbmPeriodic(p + vec2(2.4, 9.1), vec2(8.0))
  );
  vec2 q = p + (warp - 0.5) * 0.62;
  float broad = fbmPeriodic(q, vec2(8.0));
  float detail = fbmPeriodic(q * 4.0 + warp * 1.1, vec2(32.0));
  float colorNoise = fbmPeriodic(q * 2.0 + 11.0, vec2(16.0));
  float ridge = 1.0 - abs(detail * 2.0 - 1.0);
  float nebula = smoothstep(0.5, 0.9, broad * 0.78 + ridge * 0.24);
  float core = smoothstep(0.74, 1.0, broad * 0.84 + detail * 0.14);

  vec3 blue = vec3(0.045, 0.12, 0.32);
  vec3 violet = vec3(0.13, 0.075, 0.24);
  vec3 cyan = vec3(0.08, 0.24, 0.34);
  vec3 nebulaColor = mix(blue, violet, smoothstep(0.28, 0.82, colorNoise));
  nebulaColor = mix(nebulaColor, cyan, smoothstep(0.7, 0.96, detail) * 0.18);
  vec3 color = nebulaColor * (nebula * 0.62 + 0.018) + vec3(0.18, 0.32, 0.62) * core * 0.11;
  return vec4(color, clamp((nebula * 0.58 + core * 0.24) * alphaScale, 0.0, 1.0));
}
`;
