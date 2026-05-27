import * as THREE from 'three';

import type { Vector, WorldSize } from '../core/types';
import { nebulaNoiseShader } from './nebulaShader';

type SpaceBackgroundMode = 'arcade' | 'sandbox';

type SpaceBackgroundInput = {
  mode: SpaceBackgroundMode;
  now: number;
  cameraScroll?: Vector;
  cameraZoom?: number;
  playerPosition: Vector;
  playerVelocity?: Vector;
  screen: WorldSize;
  world?: WorldSize;
};

const RENDER_SCALE = 1;
const SANDBOX_RENDER_SCALE = 0.6;

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const arcadeFragmentShader = `
precision highp float;

uniform vec2 u_camera;
uniform vec2 u_resolution;
uniform vec2 u_screen;
uniform float u_seed;
uniform float u_time;

varying vec2 vUv;

${nebulaNoiseShader}

void main() {
  const float TAU = 6.28318530718;
  vec2 tileUv = fract(vec2(vUv.x, 1.0 - vUv.y));
  vec2 basePeriod = max(vec2(4.0), floor(u_resolution / 240.0 + 0.5));
  vec2 waveCycles = max(vec2(1.0), floor(basePeriod * 0.5));

  vec2 wave = vec2(
    sin((tileUv.y * waveCycles.y + tileUv.x) * TAU + sin(tileUv.x * TAU) * 0.7),
    cos((tileUv.x * waveCycles.x - tileUv.y) * TAU + sin(tileUv.y * TAU) * 0.55)
  );
  vec2 ribbonFlow = vec2(
    sin((tileUv.x + tileUv.y * waveCycles.y) * TAU),
    cos((tileUv.x * waveCycles.x + tileUv.y) * TAU)
  );
  vec2 curve = wave * 0.045 + ribbonFlow * 0.015;
  vec2 p = tileUv * basePeriod + curve;

  vec2 warp = vec2(
    fbmPeriodic(p + vec2(2.0, 3.0), basePeriod),
    fbmPeriodic(p + vec2(5.0, 1.0), basePeriod)
  );
  vec2 q = p + (warp - 0.5) * 0.62 + curve * 0.22;
  float broad = fbmPeriodic(q + vec2(1.0, 2.0), basePeriod);
  float cloud = fbmPeriodic(q + warp * 0.65 + vec2(6.0, 4.0), basePeriod);
  float detail = fbmPeriodic(q * 4.0 + warp * 2.0, basePeriod * 4.0);
  float filamentA = fbmPeriodic(q * vec2(4.0, 2.0) + curve * 2.0, basePeriod * vec2(4.0, 2.0));
  float filamentB = fbmPeriodic(q * vec2(2.0, 4.0) - curve * 2.0, basePeriod * vec2(2.0, 4.0));
  float colorNoise = fbmPeriodic(q * 2.0 + 11.0, basePeriod * 2.0);
  float ribbon = sin((tileUv.x * waveCycles.x + tileUv.y) * TAU + warp.x * 0.35 + detail * 0.12) * 0.5 + 0.5;
  float ridge = 1.0 - abs(detail * 2.0 - 1.0);
  float cloudMass = broad * 0.62 + cloud * 0.38;
  float filamentBlend = (filamentA + filamentB) * 0.5;
  float filaments = filamentBlend * 0.72 + ridge * 0.18 + ribbon * 0.02;
  float thread = smoothstep(0.68, 0.98, filaments * 0.62 + ridge * 0.18 + ribbon * 0.012);
  float nebula = smoothstep(0.34, 0.86, cloudMass * 0.92 + ridge * 0.1 + thread * 0.055);
  float core = smoothstep(0.68, 1.0, cloudMass * 0.82 + detail * 0.1 + thread * 0.06);

  vec3 deep = vec3(0.006, 0.01, 0.025);
  vec3 blue = vec3(0.045, 0.12, 0.32);
  vec3 violet = vec3(0.13, 0.075, 0.24);
  vec3 cyan = vec3(0.08, 0.28, 0.38);
  vec3 nebulaColor = mix(blue, violet, smoothstep(0.28, 0.82, colorNoise));
  nebulaColor = mix(nebulaColor, cyan, smoothstep(0.62, 0.96, detail) * 0.28);

  vec3 color = deep + nebulaColor * nebula * 1.08 + vec3(0.18, 0.34, 0.66) * core * 0.16;
  color += mix(nebulaColor, cyan, 0.45) * thread * 0.075;
  color += vec3(0.08, 0.16, 0.32) * ribbon * nebula * 0.012;
  color = pow(color, vec3(1.06));
  gl_FragColor = vec4(color, 1.0);
}
`;

const sandboxFragmentShader = `
precision highp float;

uniform vec2 u_camera_scroll;
uniform vec2 u_resolution;
uniform vec2 u_screen;
uniform float u_seed;
uniform float u_time;

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

void main() {
  vec2 renderPixel = vec2(vUv.x, 1.0 - vUv.y) * u_resolution;
  vec2 aspectUv = (renderPixel - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
  vec2 parallax = u_camera_scroll * 0.000085;
  float t = u_time * 0.00002;
  vec2 p = aspectUv * 2.1 + parallax;

  float broad = noise(p * 1.35 + vec2(t, -t * 0.7));
  float detail = noise(p * 3.2 + vec2(6.0 - t * 0.5, 2.0 + t));
  float colorNoise = noise(p * 1.75 + vec2(11.0, 4.0));
  float haze = smoothstep(0.38, 0.86, broad * 0.72 + detail * 0.28);
  float core = smoothstep(0.76, 0.98, broad * 0.8 + detail * 0.15);

  vec3 deep = vec3(0.006, 0.01, 0.025);
  vec3 blue = vec3(0.03, 0.075, 0.18);
  vec3 violet = vec3(0.075, 0.042, 0.14);
  vec3 cyan = vec3(0.035, 0.14, 0.18);
  vec3 nebulaColor = mix(blue, violet, smoothstep(0.25, 0.82, colorNoise));
  nebulaColor = mix(nebulaColor, cyan, smoothstep(0.58, 0.94, detail) * 0.24);
  vec3 color = deep + nebulaColor * (haze * 0.34 + 0.04) + vec3(0.12, 0.22, 0.38) * core * 0.08;

  gl_FragColor = vec4(pow(color, vec3(1.05)), 1.0);
}
`;

export class SpaceBackgroundRenderer {
  private arcadeRenderDirty = true;
  private camera: THREE.OrthographicCamera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private materialMode: SpaceBackgroundMode | null = null;
  private mesh: THREE.Mesh | null = null;
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

    this.ensureMaterial(input.mode);
    if (!this.material) return;

    const resized = this.resize(input.screen.width, input.screen.height, input.mode);
    if (input.mode === 'arcade' && !this.arcadeRenderDirty && !resized) return;

    this.material.uniforms.u_screen.value.set(input.screen.width, input.screen.height);
    this.material.uniforms.u_time.value = input.mode === 'arcade' ? 0 : input.now;
    this.material.uniforms.u_camera?.value.set(
      input.mode === 'arcade' ? 0 : input.playerPosition.x,
      input.mode === 'arcade' ? 0 : input.playerPosition.y,
    );
    this.material.uniforms.u_camera_scroll.value.set(
      input.cameraScroll?.x ?? input.playerPosition.x,
      input.cameraScroll?.y ?? input.playerPosition.y,
    );
    if (this.material.uniforms.u_camera_zoom) {
      this.material.uniforms.u_camera_zoom.value = input.cameraZoom ?? 1;
    }
    this.material.uniforms.u_world?.value.set(
      input.world?.width ?? input.screen.width,
      input.world?.height ?? input.screen.height,
    );
    this.renderer.render(this.scene, this.camera);
    if (input.mode === 'arcade') this.arcadeRenderDirty = false;
  }

  dispose(): void {
    this.renderer?.dispose();
    this.material?.dispose();
    this.canvas?.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.material = null;
    this.materialMode = null;
    this.mesh = null;
    this.canvas = null;
    this.arcadeRenderDirty = true;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  setVisible(visible: boolean): void {
    if (this.canvas) this.canvas.style.display = visible ? 'block' : 'none';
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
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene.add(this.mesh);
    this.ensureMaterial('arcade');
  }

  private ensureMaterial(mode: SpaceBackgroundMode): void {
    if (this.materialMode === mode || !this.mesh) return;
    this.material?.dispose();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_camera: { value: new THREE.Vector2(0, 0) },
        u_camera_scroll: { value: new THREE.Vector2(0, 0) },
        u_camera_zoom: { value: 1 },
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_screen: { value: new THREE.Vector2(1, 1) },
        u_seed: { value: this.seed },
        u_time: { value: 0 },
        u_world: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader,
      fragmentShader: mode === 'arcade' ? arcadeFragmentShader : sandboxFragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh.material = this.material;
    this.materialMode = mode;
    if (mode === 'arcade') this.arcadeRenderDirty = true;
  }

  private resize(width: number, height: number, mode: SpaceBackgroundMode): boolean {
    if (!this.renderer || !this.canvas || !this.material) return false;
    const scale = mode === 'arcade' ? RENDER_SCALE : SANDBOX_RENDER_SCALE;
    const renderWidth = Math.max(1, Math.ceil(width * scale));
    const renderHeight = Math.max(1, Math.ceil(height * scale));
    if (this.canvas.width !== renderWidth || this.canvas.height !== renderHeight) {
      this.canvas.width = renderWidth;
      this.canvas.height = renderHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.renderer.setSize(renderWidth, renderHeight, false);
      this.material.uniforms.u_resolution.value.set(renderWidth, renderHeight);
      return true;
    }
    return false;
  }
}
