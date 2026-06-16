import * as THREE from 'three';

import type { WorldSize } from '../core/types';
import { nebulaNoiseShader } from './nebulaShader';

export type SpaceBackgroundColor = {
  r: number;
  g: number;
  b: number;
};

export type SpaceNebulaPalette = {
  base: SpaceBackgroundColor;
  secondary: SpaceBackgroundColor;
  accent: SpaceBackgroundColor;
  thread: SpaceBackgroundColor;
};

type SpaceBackgroundInput = {
  nebulaPalette?: SpaceNebulaPalette;
  screen: WorldSize;
};

const RENDER_SCALE = 1;
const DEFAULT_NEBULA_PALETTE: SpaceNebulaPalette = {
  base: { r: 0.045, g: 0.12, b: 0.32 },
  secondary: { r: 0.13, g: 0.075, b: 0.24 },
  accent: { r: 0.08, g: 0.28, b: 0.38 },
  thread: { r: 0.08, g: 0.28, b: 0.38 },
};

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const arcadeFragmentShader = `
precision highp float;

uniform vec2 u_resolution;
uniform vec3 u_nebula_accent;
uniform vec3 u_nebula_base;
uniform vec3 u_nebula_secondary;
uniform vec3 u_nebula_thread;

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
  vec2 broadPoint = q + vec2(1.0, 2.0);
  vec2 cloudPoint = q + warp * 0.65 + vec2(6.0, 4.0);
  vec2 colorPoint = q * 2.0 + 11.0;
  float broad = mix(
    fbmPeriodic(broadPoint, basePeriod),
    fbmPeriodic(broadPoint + basePeriod * vec2(0.37, 0.61) + vec2(1.7, 2.3), basePeriod),
    0.28
  );
  float cloud = mix(
    fbmPeriodic(cloudPoint, basePeriod),
    fbmPeriodic(cloudPoint + basePeriod * vec2(0.53, 0.29) + vec2(4.1, 1.9), basePeriod),
    0.24
  );
  float detail = fbmPeriodic(q * 4.0 + warp * 2.0, basePeriod * 4.0);
  float filamentA = fbmPeriodic(q * vec2(4.0, 2.0) + curve * 2.0, basePeriod * vec2(4.0, 2.0));
  float filamentB = fbmPeriodic(q * vec2(2.0, 4.0) - curve * 2.0, basePeriod * vec2(2.0, 4.0));
  float colorNoise = mix(
    fbmPeriodic(colorPoint, basePeriod * 2.0),
    fbmPeriodic(colorPoint + basePeriod * vec2(1.22, 0.74) + vec2(3.5, 5.7), basePeriod * 2.0),
    0.18
  );
  float ribbon = sin((tileUv.x * waveCycles.x + tileUv.y) * TAU + warp.x * 0.35 + detail * 0.12) * 0.5 + 0.5;
  float ridge = 1.0 - abs(detail * 2.0 - 1.0);
  float cloudMass = broad * 0.62 + cloud * 0.38;
  float filamentBlend = (filamentA + filamentB) * 0.5;
  float filaments = filamentBlend * 0.72 + ridge * 0.18 + ribbon * 0.02;
  float thread = smoothstep(0.68, 0.98, filaments * 0.62 + ridge * 0.18 + ribbon * 0.012);
  float nebula = smoothstep(0.34, 0.86, cloudMass * 0.92 + ridge * 0.1 + thread * 0.055);
  float core = smoothstep(0.68, 1.0, cloudMass * 0.82 + detail * 0.1 + thread * 0.06);

  vec3 deep = vec3(0.006, 0.01, 0.025);
  vec3 nebulaColor = mix(u_nebula_base, u_nebula_secondary, smoothstep(0.28, 0.82, colorNoise));
  nebulaColor = mix(nebulaColor, u_nebula_accent, smoothstep(0.62, 0.96, detail) * 0.28);

  vec3 color = deep + nebulaColor * nebula * 1.08 + vec3(0.18, 0.34, 0.66) * core * 0.16;
  color += mix(nebulaColor, u_nebula_thread, 0.45) * thread * 0.075;
  color += vec3(0.08, 0.16, 0.32) * ribbon * nebula * 0.012;
  color = pow(color, vec3(1.06));
  gl_FragColor = vec4(color, 1.0);
}
`;

export class SpaceBackgroundRenderer {
  private arcadeRenderDirty = true;
  private camera: THREE.OrthographicCamera | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private mesh: THREE.Mesh | null = null;
  private nebulaPalette = DEFAULT_NEBULA_PALETTE;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;

  constructor(
    private readonly sourceCanvas: HTMLCanvasElement,
    private readonly parent: HTMLElement | null,
  ) {}

  render(input: SpaceBackgroundInput): void {
    this.ensureInitialized();
    if (!this.renderer || !this.scene || !this.camera || !this.canvas) return;

    this.ensureMaterial();
    if (!this.material) return;

    const paletteChanged = this.setNebulaPalette(input.nebulaPalette);
    const resized = this.resize(input.screen.width, input.screen.height);
    if (!this.arcadeRenderDirty && !paletteChanged && !resized) return;

    this.renderer.render(this.scene, this.camera);
    this.arcadeRenderDirty = false;
  }

  dispose(): void {
    this.renderer?.dispose();
    this.material?.dispose();
    this.canvas?.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.material = null;
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
    this.ensureMaterial();
  }

  private ensureMaterial(): void {
    if (this.material || !this.mesh) return;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_nebula_accent: { value: colorVector(this.nebulaPalette.accent) },
        u_nebula_base: { value: colorVector(this.nebulaPalette.base) },
        u_nebula_secondary: { value: colorVector(this.nebulaPalette.secondary) },
        u_nebula_thread: { value: colorVector(this.nebulaPalette.thread) },
        u_resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader,
      fragmentShader: arcadeFragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh.material = this.material;
    this.arcadeRenderDirty = true;
  }

  private setNebulaPalette(palette = DEFAULT_NEBULA_PALETTE): boolean {
    if (!this.material) return false;
    const changed = !samePalette(this.nebulaPalette, palette);
    if (changed) {
      this.nebulaPalette = palette;
      setColorUniform(this.material.uniforms.u_nebula_base.value, palette.base);
      setColorUniform(this.material.uniforms.u_nebula_secondary.value, palette.secondary);
      setColorUniform(this.material.uniforms.u_nebula_accent.value, palette.accent);
      setColorUniform(this.material.uniforms.u_nebula_thread.value, palette.thread);
      this.arcadeRenderDirty = true;
    }
    return changed;
  }

  private resize(width: number, height: number): boolean {
    if (!this.renderer || !this.canvas || !this.material) return false;
    const renderWidth = Math.max(1, Math.ceil(width * RENDER_SCALE));
    const renderHeight = Math.max(1, Math.ceil(height * RENDER_SCALE));
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

function colorVector(color: SpaceBackgroundColor): THREE.Vector3 {
  return new THREE.Vector3(color.r, color.g, color.b);
}

function setColorUniform(target: THREE.Vector3, color: SpaceBackgroundColor): void {
  target.set(color.r, color.g, color.b);
}

function sameColor(a: SpaceBackgroundColor, b: SpaceBackgroundColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

function samePalette(a: SpaceNebulaPalette, b: SpaceNebulaPalette): boolean {
  return (
    sameColor(a.base, b.base) &&
    sameColor(a.secondary, b.secondary) &&
    sameColor(a.accent, b.accent) &&
    sameColor(a.thread, b.thread)
  );
}
