import * as THREE from 'three';

import type { Vector, WorldSize } from '../core/types';

type SpaceBackgroundMode = 'arcade' | 'sandbox';

type SpaceBackgroundInput = {
  mode: SpaceBackgroundMode;
  now: number;
  playerPosition: Vector;
  playerVelocity?: Vector;
  screen: WorldSize;
  world?: WorldSize;
};

const RENDER_SCALE = 0.75;

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform vec2 u_camera;
uniform int u_mode;
uniform vec2 u_resolution;
uniform float u_seed;
uniform float u_time;
uniform vec2 u_world;

varying vec2 vUv;

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

float star(vec2 uv, float scale, float threshold) {
  vec2 grid = uv * scale;
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float h = hash(cell);
  float d = length(local);
  float brightness = smoothstep(threshold, 1.0, h);
  return brightness * smoothstep(0.09, 0.0, d);
}

void main() {
  vec2 pixel = vUv * u_resolution;
  vec2 aspectUv = (pixel - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
  vec2 camera = u_mode == 0
    ? u_camera * 0.00075
    : vec2(u_camera.x / max(u_world.x, 1.0), u_camera.y / max(u_world.y, 1.0)) * 7.0;

  float morph = u_time * 0.000018;
  vec2 p = aspectUv * 2.0 + camera;
  vec2 warp = vec2(
    fbm(p * 1.15 + vec2(7.2 + morph, 1.9 - morph * 0.7)),
    fbm(p * 1.15 + vec2(2.4 - morph * 0.8, 9.1 + morph * 0.6))
  );
  vec2 q = p + (warp - 0.5) * 0.62;
  float broad = fbm(q * 1.25 + vec2(morph * 0.35, -morph * 0.22));
  float detail = fbm(q * 3.8 + warp * 1.1 + vec2(-morph * 0.6, morph * 0.45));
  float ridge = 1.0 - abs(detail * 2.0 - 1.0);
  float nebula = smoothstep(0.5, 0.9, broad * 0.78 + ridge * 0.24);
  float core = smoothstep(0.74, 1.0, broad * 0.84 + detail * 0.14);

  vec3 deep = vec3(0.006, 0.01, 0.025);
  vec3 blue = vec3(0.045, 0.12, 0.32);
  vec3 violet = vec3(0.13, 0.075, 0.24);
  vec3 cyan = vec3(0.08, 0.24, 0.34);
  float colorNoise = fbm(q * 2.2 + 11.0);
  vec3 nebulaColor = mix(blue, violet, smoothstep(0.28, 0.82, colorNoise));
  nebulaColor = mix(nebulaColor, cyan, smoothstep(0.7, 0.96, detail) * 0.18);

  float starA = star(aspectUv + camera * 0.18, 145.0, 0.986);
  float starB = star(aspectUv + camera * 0.26 + 9.7, 250.0, 0.994) * 0.62;
  float starGlow = star(aspectUv + camera * 0.12 + 3.2, 70.0, 0.993) * 0.22;
  vec3 stars = vec3(starA + starB) + vec3(0.55, 0.72, 1.0) * starGlow;

  float modeStrength = u_mode == 0 ? 0.72 : 0.32;
  vec3 color = deep + nebulaColor * nebula * modeStrength + vec3(0.18, 0.32, 0.62) * core * 0.08 * modeStrength;
  color += stars;
  color = pow(color, vec3(1.06));
  gl_FragColor = vec4(color, 1.0);
}
`;

export class SpaceBackgroundRenderer {
  private camera: THREE.OrthographicCamera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private readonly seed = Math.random() * 1000;

  constructor(
    private readonly sourceCanvas: HTMLCanvasElement,
    private readonly parent: HTMLElement | null,
  ) {}

  render(input: SpaceBackgroundInput): void {
    this.ensureInitialized();
    if (!this.renderer || !this.scene || !this.camera || !this.material || !this.canvas) return;

    this.resize(input.screen.width, input.screen.height);
    this.material.uniforms.u_time.value = input.now;
    this.material.uniforms.u_mode.value = input.mode === 'arcade' ? 0 : 1;
    this.material.uniforms.u_camera.value.set(input.playerPosition.x, input.playerPosition.y);
    this.material.uniforms.u_world.value.set(
      input.world?.width ?? input.screen.width,
      input.world?.height ?? input.screen.height,
    );
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer?.dispose();
    this.material?.dispose();
    this.canvas?.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.material = null;
    this.canvas = null;
  }

  private ensureInitialized(): void {
    if (this.renderer || !this.parent) return;

    this.sourceCanvas.style.position = 'relative';
    this.sourceCanvas.style.zIndex = '1';
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '0';
    this.parent.insertBefore(this.canvas, this.sourceCanvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_camera: { value: new THREE.Vector2(0, 0) },
        u_mode: { value: 0 },
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_seed: { value: this.seed },
        u_time: { value: 0 },
        u_world: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  private resize(width: number, height: number): void {
    if (!this.renderer || !this.canvas || !this.material) return;
    const renderWidth = Math.max(1, Math.ceil(width * RENDER_SCALE));
    const renderHeight = Math.max(1, Math.ceil(height * RENDER_SCALE));
    if (this.canvas.width !== renderWidth || this.canvas.height !== renderHeight) {
      this.canvas.width = renderWidth;
      this.canvas.height = renderHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.renderer.setSize(renderWidth, renderHeight, false);
      this.material.uniforms.u_resolution.value.set(renderWidth, renderHeight);
    }
  }
}
