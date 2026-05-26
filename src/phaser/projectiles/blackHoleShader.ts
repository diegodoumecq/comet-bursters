import * as THREE from 'three';

import {
  BLACK_HOLE_RADIUS,
  DISTORTION_RADIUS,
  DISTORTION_STRENGTH,
  MAX_BLACK_HOLES,
} from './blackHoles';

export type BlackHoleScreenSample = {
  radius: number;
  x: number;
  y: number;
};

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
uniform sampler2D u_bhPositions;
uniform float u_distortionRadius;
uniform float u_distortionStrength;
uniform int u_blackHoleCount;
uniform vec2 u_resolution;
uniform bool u_sourceReady;

varying vec2 vUv;

void main() {
  vec2 pixelPos = vUv * u_resolution;
  vec4 color = texture2D(u_texture, vUv);
  bool affected = false;

  if (!u_sourceReady) {
    color = vec4(0.0, 0.0, 0.0, 0.0);
  }

  vec2 currentPos = pixelPos;

  for (int i = 0; i < ${MAX_BLACK_HOLES}; i++) {
    if (i >= u_blackHoleCount) break;

    vec2 bhUV = vec2((float(i) + 0.5) / float(${MAX_BLACK_HOLES}), 0.5);
    vec4 bhData = texture2D(u_bhPositions, bhUV);
    vec2 bhPos = bhData.xy;
    float blackHoleRadius = bhData.z;
    float distortionRadius = max(blackHoleRadius + 1.0, u_distortionRadius * bhData.w);
    float dist = length(currentPos - bhPos);

    if (dist >= blackHoleRadius && dist < distortionRadius) {
      affected = true;
      vec2 diff = currentPos - bhPos;
      float t = 1.0 - (dist - blackHoleRadius) / (distortionRadius - blackHoleRadius);
      float bendStrength = pow(t, 2.0) * u_distortionStrength;

      currentPos = currentPos + normalize(diff) * bendStrength * 30.0;
      vec2 distortedUV = currentPos / u_resolution;
      color = texture2D(u_texture, distortedUV);
      if (!u_sourceReady) {
        color = vec4(0.0, 0.0, 0.0, 0.0);
      }
    }
  }

  for (int i = 0; i < ${MAX_BLACK_HOLES}; i++) {
    if (i >= u_blackHoleCount) break;

    vec2 bhUV = vec2((float(i) + 0.5) / float(${MAX_BLACK_HOLES}), 0.5);
    vec4 bhData = texture2D(u_bhPositions, bhUV);
    vec2 bhPos = bhData.xy;
    float blackHoleRadius = bhData.z;
    float dist = length(pixelPos - bhPos);

    if (dist < blackHoleRadius) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
  }

  for (int i = 0; i < ${MAX_BLACK_HOLES}; i++) {
    if (i >= u_blackHoleCount) break;

    vec2 bhUV = vec2((float(i) + 0.5) / float(${MAX_BLACK_HOLES}), 0.5);
    vec4 bhData = texture2D(u_bhPositions, bhUV);
    vec2 bhPos = bhData.xy;
    float blackHoleRadius = bhData.z;
    float dist = length(pixelPos - bhPos);

    if (dist >= blackHoleRadius && dist < blackHoleRadius + 1.0) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      return;
    }
  }

  for (int i = 0; i < ${MAX_BLACK_HOLES}; i++) {
    if (i >= u_blackHoleCount) break;

    vec2 bhUV = vec2((float(i) + 0.5) / float(${MAX_BLACK_HOLES}), 0.5);
    vec4 bhData = texture2D(u_bhPositions, bhUV);
    vec2 bhPos = bhData.xy;
    float blackHoleRadius = bhData.z;
    float dist = length(pixelPos - bhPos);

    if (dist >= blackHoleRadius && dist < blackHoleRadius * 2.5) {
      affected = true;
      float tintStrength = 1.0 - (dist - blackHoleRadius) / (blackHoleRadius * 1.5);
      color.rgb = mix(color.rgb, vec3(0.6, 0.3, 1.0), tintStrength * 0.5);
    }
  }

  if (!affected) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  gl_FragColor = color;
}
`;

export class BlackHoleShaderRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private texture: THREE.CanvasTexture | null = null;
  private dataTexture: THREE.DataTexture | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private compositeCanvas: HTMLCanvasElement | null = null;
  private compositeContext: CanvasRenderingContext2D | null = null;

  constructor(
    private readonly sourceCanvas: HTMLCanvasElement,
    private readonly getUnderlayCanvases: () => HTMLCanvasElement[] = () => [],
    private readonly getOverlayCanvases: () => HTMLCanvasElement[] = () => [],
  ) {}

  render(blackHoles: BlackHoleScreenSample[]): void {
    this.ensureInitialized();
    if (
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.material ||
      !this.dataTexture ||
      !this.texture ||
      !this.canvas
    )
      return;

    this.resize(this.sourceCanvas.width, this.sourceCanvas.height);
    const count = Math.min(blackHoles.length, MAX_BLACK_HOLES);
    this.material.uniforms.u_blackHoleCount.value = count;
    if (count === 0) {
      this.canvas.style.display = 'none';
      this.renderer.clear();
      return;
    }
    this.canvas.style.display = 'block';
    this.material.uniforms.u_sourceReady.value = this.updateCompositeSource();

    const data = this.dataTexture.image.data as Float32Array;
    for (let index = 0; index < count; index += 1) {
      const radius = blackHoles[index].radius;
      data[index * 4] = blackHoles[index].x;
      data[index * 4 + 1] = this.sourceCanvas.height - blackHoles[index].y;
      data[index * 4 + 2] = radius;
      data[index * 4 + 3] = radius / BLACK_HOLE_RADIUS;
    }

    this.dataTexture.needsUpdate = true;
    this.texture.needsUpdate = true;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer?.dispose();
    this.texture?.dispose();
    this.dataTexture?.dispose();
    this.material?.dispose();
    this.canvas?.remove();
    this.compositeCanvas = null;
    this.compositeContext = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.material = null;
    this.texture = null;
    this.dataTexture = null;
    this.canvas = null;
  }

  setVisible(visible: boolean): void {
    if (this.canvas) this.canvas.style.display = visible ? 'block' : 'none';
  }

  private ensureInitialized(): void {
    if (this.renderer) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '4';
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

    const data = new Float32Array(MAX_BLACK_HOLES * 4);
    this.dataTexture = new THREE.DataTexture(
      data,
      MAX_BLACK_HOLES,
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.dataTexture.needsUpdate = true;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_texture: { value: this.texture },
        u_bhPositions: { value: this.dataTexture },
        u_distortionRadius: { value: DISTORTION_RADIUS },
        u_distortionStrength: { value: DISTORTION_STRENGTH },
        u_blackHoleCount: { value: 0 },
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_sourceReady: { value: false },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  private resize(width: number, height: number): void {
    if (!this.renderer || !this.canvas || !this.material) return;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      if (this.compositeCanvas) {
        this.compositeCanvas.width = width;
        this.compositeCanvas.height = height;
      }
      this.renderer.setSize(width, height, false);
      this.material.uniforms.u_resolution.value.set(width, height);
    }
  }

  private updateCompositeSource(): boolean {
    if (!this.compositeCanvas || !this.compositeContext) return false;

    this.compositeContext.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
    try {
      const underlays = this.getUnderlayCanvases();
      if (underlays.length === 0) {
        this.compositeContext.fillStyle = '#05070d';
        this.compositeContext.fillRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
      }
      for (const underlay of underlays) {
        this.compositeContext.drawImage(
          underlay,
          0,
          0,
          this.compositeCanvas.width,
          this.compositeCanvas.height,
        );
      }
      this.compositeContext.drawImage(
        this.sourceCanvas,
        0,
        0,
        this.compositeCanvas.width,
        this.compositeCanvas.height,
      );
    } catch {
      return false;
    }
    for (const overlay of this.getOverlayCanvases()) {
      this.compositeContext.drawImage(
        overlay,
        0,
        0,
        this.compositeCanvas.width,
        this.compositeCanvas.height,
      );
    }
    return true;
  }
}
