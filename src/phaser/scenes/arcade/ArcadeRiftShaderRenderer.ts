import Phaser from 'phaser';
import * as THREE from 'three';

import { RIFT_CLOSE_DURATION_MS } from '../../rifts/config';
import type { RiftPortal } from '../../rifts/types';

const MAX_RIFTS = 8;
const RIFT_SHADER_DEPTH = -25;
let nextRiftTextureId = 0;

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

vec4 sampleSource(vec2 pixel) {
  vec2 uv = vec2(pixel.x / u_resolution.x, 1.0 - pixel.y / u_resolution.y);
  return texture2D(u_texture, clamp(uv, vec2(0.001), vec2(0.999)));
}

void main() {
  vec2 pixel = vec2(vUv.x * u_resolution.x, (1.0 - vUv.y) * u_resolution.y);
  vec3 accumColor = vec3(0.0);
  float alpha = 0.0;

  for (int index = 0; index < ${MAX_RIFTS}; index++) {
    if (index >= u_riftCount) break;
    vec4 core = texture2D(u_riftData, vec2((float(index) + 0.5) / float(${MAX_RIFTS}), 0.25));
    vec4 timing = texture2D(u_riftData, vec2((float(index) + 0.5) / float(${MAX_RIFTS}), 0.75));

    vec2 center = core.xy;
    float radiusX = core.z;
    float radiusY = core.w;
    float angle = timing.x;
    float openedAt = timing.y;
    float openDuration = timing.z;
    float closeStartedAt = timing.w;
    float age = max(0.0, u_now - openedAt);
    float opening = smoothstep(0.0, 1.0, clamp(age / max(1.0, openDuration), 0.0, 1.0));
    float closing = closeStartedAt < 0.0 ? 0.0 : smoothstep(0.0, 1.0, clamp((u_now - closeStartedAt) / ${RIFT_CLOSE_DURATION_MS.toFixed(1)}, 0.0, 1.0));
    float fade = opening * (1.0 - closing);

    vec2 normal = vec2(cos(angle), sin(angle));
    vec2 tangent = vec2(-normal.y, normal.x);
    vec2 local = pixel - center;
    float along = dot(local, tangent);
    float across = dot(local, normal);
    float ellipse = (along * along) / max(1.0, radiusX * radiusX) + (across * across) / max(1.0, radiusY * radiusY);
    float portalMask = smoothstep(1.0, 0.985, ellipse) * fade;
    float hardPortalMask = smoothstep(1.0, 0.98, ellipse) * fade;

    vec4 sourceInside = sampleSource(pixel);
    float insideSourceAlpha = sourceInside.a * hardPortalMask;
    accumColor = mix(accumColor, sourceInside.rgb, insideSourceAlpha);
    alpha = max(alpha, max(portalMask, insideSourceAlpha));
  }

  if (alpha <= 0.001) discard;

  vec3 color = mix(vec3(0.0), accumColor, step(0.004, dot(accumColor, vec3(0.333))));
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
  private outputCanvas: HTMLCanvasElement | null = null;
  private outputContext: CanvasRenderingContext2D | null = null;
  private outputImage: Phaser.GameObjects.Image | null = null;
  private outputTexture: Phaser.Textures.CanvasTexture | null = null;
  private readonly outputTextureKey = `phaser-arcade-rift-shader-${nextRiftTextureId++}`;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly portals: RiftPortal[] = [];
  private scene: THREE.Scene | null = null;
  private texture: THREE.CanvasTexture | null = null;

  constructor(
    private readonly phaserScene: Phaser.Scene,
    private readonly hostCanvas: HTMLCanvasElement,
    private getPortalSourceCanvas: () => HTMLCanvasElement,
    private readonly getUnderlayCanvases: () => HTMLCanvasElement[] = () => [],
    private readonly debug = false,
  ) {}

  add(portal: RiftPortal): void {
    this.portals.push(portal);
  }

  setPortals(portals: RiftPortal[]): void {
    this.portals.length = 0;
    this.portals.push(...portals);
  }

  setPortalSourceCanvasProvider(getPortalSourceCanvas: () => HTMLCanvasElement): void {
    this.getPortalSourceCanvas = getPortalSourceCanvas;
  }

  render(now: number): void {
    this.ensureInitialized();
    if (
      !this.canvas ||
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.material ||
      !this.outputCanvas ||
      !this.outputContext ||
      !this.outputImage ||
      !this.outputTexture ||
      !this.texture ||
      !this.dataTexture
    )
      return;

    this.resize(this.hostCanvas.width, this.hostCanvas.height);
    const count = Math.min(this.portals.length, MAX_RIFTS);
    this.material.uniforms.u_riftCount.value = count;
    if (count === 0) {
      this.outputImage.setVisible(false);
      this.renderer.clear();
      this.clearOutputTexture();
      this.outputTexture.refresh();
      return;
    }

    this.outputImage.setVisible(true);
    this.material.uniforms.u_now.value = now;
    this.updateCompositeSource();
    this.updateRiftData(count);
    this.texture.needsUpdate = true;
    this.dataTexture.needsUpdate = true;
    if (this.debug) {
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      this.copyShaderToOutputTexture();
      this.outputTexture.refresh();
      return;
    }
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.copyShaderToOutputTexture();
    this.outputTexture.refresh();
  }

  destroy(): void {
    this.renderer?.dispose();
    this.material?.dispose();
    this.texture?.dispose();
    this.dataTexture?.dispose();
    this.outputImage?.destroy();
    this.phaserScene.textures.remove(this.outputTextureKey);
    this.canvas = null;
    this.camera = null;
    this.compositeCanvas = null;
    this.compositeContext = null;
    this.dataTexture = null;
    this.material = null;
    this.outputCanvas = null;
    this.outputContext = null;
    this.outputImage = null;
    this.outputTexture = null;
    this.renderer = null;
    this.portals.length = 0;
    this.scene = null;
    this.texture = null;
  }

  private ensureInitialized(): void {
    if (this.renderer) return;

    this.canvas = document.createElement('canvas');
    this.outputCanvas = document.createElement('canvas');
    this.outputContext = this.outputCanvas.getContext('2d');
    this.outputTexture = this.phaserScene.textures.addCanvas(
      this.outputTextureKey,
      this.outputCanvas,
    );
    if (!this.outputTexture) {
      throw new Error(`Failed to create arcade rift shader texture ${this.outputTextureKey}`);
    }
    this.outputImage = this.phaserScene.add
      .image(0, 0, this.outputTextureKey)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(RIFT_SHADER_DEPTH)
      .setVisible(false);

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
    if (
      !this.canvas ||
      !this.renderer ||
      !this.material ||
      !this.compositeCanvas ||
      !this.outputCanvas ||
      !this.outputImage
    )
      return;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.compositeCanvas.width = width;
      this.compositeCanvas.height = height;
      this.outputCanvas.width = width;
      this.outputCanvas.height = height;
      this.renderer.setSize(width, height, false);
      this.material.uniforms.u_resolution.value.set(width, height);
    }
    this.outputImage.setDisplaySize(width, height);
  }

  private clearOutputTexture(): void {
    if (!this.outputCanvas || !this.outputContext) return;
    this.outputContext.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
  }

  private copyShaderToOutputTexture(): void {
    if (!this.canvas || !this.outputCanvas || !this.outputContext) return;
    this.outputContext.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    this.outputContext.drawImage(
      this.canvas,
      0,
      0,
      this.outputCanvas.width,
      this.outputCanvas.height,
    );
  }

  private updateCompositeSource(): void {
    if (!this.compositeCanvas || !this.compositeContext) return;
    this.compositeContext.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
    const portalSourceCanvas = this.getPortalSourceCanvas();
    for (const canvas of this.getUnderlayCanvases()) {
      this.compositeContext.drawImage(
        canvas,
        0,
        0,
        this.compositeCanvas.width,
        this.compositeCanvas.height,
      );
    }
    this.compositeContext.drawImage(
      portalSourceCanvas,
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
      const portal = this.portals[index];
      const core = index * 4;
      const timing = (MAX_RIFTS + index) * 4;
      data[core] = portal.position.x;
      data[core + 1] = portal.position.y;
      data[core + 2] = portal.apertureRadiusX;
      data[core + 3] = portal.apertureRadiusY;
      data[timing] = portal.angle;
      data[timing + 1] = portal.openedAt;
      data[timing + 2] = portal.openDurationMs;
      data[timing + 3] = portal.closeStartedAt ?? -1;
    }
  }
}
