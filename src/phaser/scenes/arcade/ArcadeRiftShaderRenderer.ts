import * as THREE from 'three';

import type { ArcadeRift } from './arcadeSpawns';

const MAX_RIFTS = 8;

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform sampler2D u_texture;
uniform sampler2D u_riftData;
uniform vec2 u_resolution;
uniform float u_now;
uniform int u_riftCount;

varying vec2 vUv;

float hash(float value) {
  return fract(sin(value * 127.1) * 43758.5453123);
}

vec4 sampleSource(vec2 pixel) {
  vec2 uv = vec2(pixel.x / u_resolution.x, 1.0 - pixel.y / u_resolution.y);
  return texture2D(u_texture, clamp(uv, vec2(0.001), vec2(0.999)));
}

void main() {
  vec2 pixel = vec2(vUv.x * u_resolution.x, (1.0 - vUv.y) * u_resolution.y);
  vec2 distortion = vec2(0.0);
  vec3 glow = vec3(0.0);
  float alpha = 0.0;
  float shadowMask = 0.0;
  float voidMask = 0.0;

  for (int index = 0; index < ${MAX_RIFTS}; index++) {
    if (index >= u_riftCount) break;
    vec4 core = texture2D(u_riftData, vec2((float(index) + 0.5) / float(${MAX_RIFTS}), 0.25));
    vec4 timing = texture2D(u_riftData, vec2((float(index) + 0.5) / float(${MAX_RIFTS}), 0.75));

    vec2 center = core.xy;
    float riftLength = core.z;
    float width = core.w;
    float angle = timing.x;
    float openedAt = timing.y;
    float releaseAt = timing.z;
    float duration = timing.w;
    float age = max(0.0, u_now - openedAt);
    float progress = clamp(age / max(1.0, duration), 0.0, 1.0);
    float opening = smoothstep(0.0, 1.0, clamp(age / max(1.0, releaseAt - openedAt), 0.0, 1.0));
    float fade = max(opening * (1.0 - smoothstep(0.82, 1.0, progress)), sin(progress * 3.14159265359) * opening);

    vec2 normal = vec2(cos(angle), sin(angle));
    vec2 tangent = vec2(-normal.y, normal.x);
    vec2 local = pixel - center;
    float along = dot(local, tangent);
    float across = dot(local, normal);
    float jagged = (hash(floor(along / 18.0) + float(index) * 31.0) - 0.5) * width * 0.62;
    float slit = abs(across - jagged);
    float alongMask = smoothstep(riftLength * 0.52, riftLength * 0.28, abs(along));
    float rim = smoothstep(width * 1.9, width * 0.26, slit) * alongMask * fade;
    float coreMask = smoothstep(width * 0.92, 0.0, slit) * alongMask * fade;
    float influence = smoothstep(riftLength * 0.86, 0.0, length(local)) * fade;
    float signedSlitDistance = across - jagged;
    float side = sign(signedSlitDistance);
    float frontSide = smoothstep(0.0, width * 1.35, signedSlitDistance);
    float backSide = smoothstep(0.0, width * 1.8, -signedSlitDistance);
    float backMouth = smoothstep(width * 3.2, 0.0, abs(signedSlitDistance + width * 0.95)) * backSide * alongMask * fade;
    float frontRim = smoothstep(width * 1.35, 0.0, abs(signedSlitDistance - width * 0.42)) * frontSide * alongMask * fade;

    distortion += normal * side * rim * width * 0.44;
    distortion += tangent * sin(along * 0.045 + u_now * 0.012 + float(index)) * influence * 5.0;
    voidMask = max(voidMask, coreMask);
    shadowMask = max(shadowMask, backMouth * 0.78);
    glow += vec3(0.45, 0.95, 1.0) * rim * 0.56;
    glow += vec3(0.62, 1.0, 1.0) * frontRim * 1.08;
    glow += vec3(1.0, 0.22, 0.86) * smoothstep(width * 0.9, 0.0, slit) * alongMask * fade * 0.28;
    glow += vec3(0.26, 0.2, 0.62) * backMouth * 0.42;
    alpha = max(alpha, rim * 0.74 + coreMask + backMouth * 0.55 + frontRim * 0.72);
  }

  if (alpha <= 0.001) discard;

  vec4 source = sampleSource(pixel + distortion);
  vec3 fallback = vec3(0.01, 0.018, 0.035);
  vec3 sampled = mix(fallback, source.rgb, step(0.004, dot(source.rgb, vec3(0.333))));
  vec3 color = mix(sampled, vec3(0.0, 0.004, 0.015), max(voidMask * 0.94, shadowMask));
  color += glow;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`;

export class ArcadeRiftShaderRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private compositeCanvas: HTMLCanvasElement | null = null;
  private compositeContext: CanvasRenderingContext2D | null = null;
  private dataTexture: THREE.DataTexture | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly rifts: ArcadeRift[] = [];
  private scene: THREE.Scene | null = null;
  private texture: THREE.CanvasTexture | null = null;

  constructor(
    private readonly sourceCanvas: HTMLCanvasElement,
    private readonly getUnderlayCanvases: () => HTMLCanvasElement[] = () => [],
    private readonly debug = false,
  ) {}

  add(rifts: ArcadeRift[]): void {
    this.rifts.push(...rifts);
  }

  render(now: number): void {
    this.ensureInitialized();
    if (
      !this.canvas ||
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.material ||
      !this.texture ||
      !this.dataTexture
    )
      return;

    this.resize(this.sourceCanvas.width, this.sourceCanvas.height);
    this.removeExpired(now);
    const count = Math.min(this.rifts.length, MAX_RIFTS);
    this.material.uniforms.u_riftCount.value = count;
    if (count === 0) {
      this.canvas.style.display = 'none';
      this.renderer.clear();
      return;
    }

    this.canvas.style.display = 'block';
    if (this.debug) {
      this.canvas.style.zIndex = '1001';
    }
    this.material.uniforms.u_now.value = now;
    this.updateCompositeSource();
    this.updateRiftData(count);
    this.texture.needsUpdate = true;
    this.dataTexture.needsUpdate = true;
    if (this.debug) {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    this.renderer?.dispose();
    this.material?.dispose();
    this.texture?.dispose();
    this.dataTexture?.dispose();
    this.canvas?.remove();
    this.canvas = null;
    this.camera = null;
    this.compositeCanvas = null;
    this.compositeContext = null;
    this.dataTexture = null;
    this.material = null;
    this.renderer = null;
    this.rifts.length = 0;
    this.scene = null;
    this.texture = null;
  }

  private ensureInitialized(): void {
    if (this.renderer) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = this.debug ? '5' : '3';
    this.sourceCanvas.parentElement?.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.compositeCanvas = document.createElement('canvas');
    this.compositeContext = this.compositeCanvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.compositeCanvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.dataTexture = new THREE.DataTexture(
      new Float32Array(MAX_RIFTS * 2 * 4),
      MAX_RIFTS,
      2,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.dataTexture.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_now: { value: 0 },
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_riftCount: { value: 0 },
        u_riftData: { value: this.dataTexture },
        u_texture: { value: this.texture },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  private resize(width: number, height: number): void {
    if (!this.canvas || !this.renderer || !this.material || !this.compositeCanvas) return;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.compositeCanvas.width = width;
      this.compositeCanvas.height = height;
      this.renderer.setSize(width, height, false);
      this.material.uniforms.u_resolution.value.set(width, height);
    }
  }

  private removeExpired(now: number): void {
    const active = this.rifts.filter((rift) => now - rift.openedAt < rift.durationMs);
    this.rifts.length = 0;
    this.rifts.push(...active);
  }

  private updateCompositeSource(): void {
    if (!this.compositeCanvas || !this.compositeContext) return;
    this.compositeContext.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
    for (const canvas of this.getUnderlayCanvases()) {
      this.compositeContext.drawImage(canvas, 0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
    }
    this.compositeContext.drawImage(
      this.sourceCanvas,
      0,
      0,
      this.compositeCanvas.width,
      this.compositeCanvas.height,
    );
  }

  private updateRiftData(count: number): void {
    if (!this.dataTexture) return;
    const data = this.dataTexture.image.data as Float32Array;
    data.fill(0);
    for (let index = 0; index < count; index += 1) {
      const rift = this.rifts[index];
      const core = index * 4;
      const timing = (MAX_RIFTS + index) * 4;
      data[core] = rift.position.x;
      data[core + 1] = rift.position.y;
      data[core + 2] = rift.length;
      data[core + 3] = rift.width;
      data[timing] = rift.angle;
      data[timing + 1] = rift.openedAt;
      data[timing + 2] = rift.releaseAt;
      data[timing + 3] = rift.durationMs;
    }
  }
}
