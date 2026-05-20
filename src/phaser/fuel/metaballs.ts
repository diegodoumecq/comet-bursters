import * as THREE from 'three';

export type FuelMetaball = {
  radius: number;
  seed: number;
  x: number;
  y: number;
};

const MAX_METABALLS = 96;
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

uniform sampler2D u_metaballs;
uniform int u_metaballCount;
uniform vec2 u_resolution;
uniform float u_time;

varying vec2 vUv;

void main() {
  vec2 pixelPos = vec2(vUv.x * u_resolution.x, (1.0 - vUv.y) * u_resolution.y);
  float field = 0.0;
  vec3 weightedColor = vec3(0.0);

  for (int i = 0; i < ${MAX_METABALLS}; i++) {
    if (i >= u_metaballCount) break;

    vec2 sampleUv = vec2((float(i) + 0.5) / float(${MAX_METABALLS}), 0.5);
    vec4 blob = texture2D(u_metaballs, sampleUv);
    vec2 center = blob.xy;
    float radius = blob.z;
    float seed = blob.w;
    float pulse = 0.92 + sin(u_time * 0.004 + seed * 6.2831) * 0.08;
    float d = max(1.0, length(pixelPos - center));
    float contribution = (radius * radius * pulse) / (d * d);
    field += contribution;
    weightedColor += vec3(0.1, 0.92, 1.0) * contribution;
  }

  float body = smoothstep(0.72, 0.9, field);
  float rim = smoothstep(0.48, 0.72, field) - smoothstep(0.86, 1.08, field);
  if (body <= 0.0 && rim <= 0.0) {
    discard;
  }

  vec3 color = weightedColor / max(field, 0.001);
  float bands = 0.5 + 0.5 * sin((pixelPos.x + pixelPos.y) * 0.055 + u_time * 0.006);
  float filaments = smoothstep(0.58, 1.0, bands) * body;
  color = mix(color, vec3(0.65, 1.0, 1.0), body * 0.45);
  color += vec3(0.15, 0.85, 1.0) * filaments * 0.28;
  color += vec3(0.75, 1.0, 1.0) * rim * 0.95;
  float alpha = body * 0.78 + rim * 0.52;
  gl_FragColor = vec4(color, alpha);
}
`;

export class FuelMetaballRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private dataTexture: THREE.DataTexture | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(private readonly parent: HTMLElement) {}

  render(metaballs: FuelMetaball[], now: number, width: number, height: number): void {
    this.ensureInitialized(width, height);
    if (
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.material ||
      !this.dataTexture ||
      !this.canvas
    )
      return;

    this.resize(width, height);
    const count = Math.min(metaballs.length, MAX_METABALLS);
    this.material.uniforms.u_metaballCount.value = count;
    if (count === 0) {
      this.renderer.clear();
      return;
    }

    const data = this.dataTexture.image.data as Float32Array;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < count; index += 1) {
      const x = metaballs[index].x * RENDER_SCALE;
      const y = metaballs[index].y * RENDER_SCALE;
      const radius = metaballs[index].radius * RENDER_SCALE;
      const influenceRadius = radius * 4;
      minX = Math.min(minX, x - influenceRadius);
      minY = Math.min(minY, y - influenceRadius);
      maxX = Math.max(maxX, x + influenceRadius);
      maxY = Math.max(maxY, y + influenceRadius);

      data[index * 4] = x;
      data[index * 4 + 1] = y;
      data[index * 4 + 2] = radius;
      data[index * 4 + 3] = metaballs[index].seed;
    }

    this.material.uniforms.u_time.value = now;
    this.dataTexture.needsUpdate = true;

    const scissorLeft = Math.max(0, Math.floor(minX));
    const scissorTop = Math.max(0, Math.floor(minY));
    const scissorRight = Math.min(this.canvas.width, Math.ceil(maxX));
    const scissorBottom = Math.min(this.canvas.height, Math.ceil(maxY));
    const scissorWidth = scissorRight - scissorLeft;
    const scissorHeight = scissorBottom - scissorTop;
    if (scissorWidth <= 0 || scissorHeight <= 0) return;

    this.renderer.clear();
    this.renderer.setScissorTest(true);
    this.renderer.setScissor(
      scissorLeft,
      this.canvas.height - scissorBottom,
      scissorWidth,
      scissorHeight,
    );
    this.renderer.render(this.scene, this.camera);
    this.renderer.setScissorTest(false);
  }

  dispose(): void {
    this.renderer?.dispose();
    this.dataTexture?.dispose();
    this.material?.dispose();
    this.canvas?.remove();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.material = null;
    this.dataTexture = null;
    this.canvas = null;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  setVisible(visible: boolean): void {
    if (this.canvas) this.canvas.style.display = visible ? 'block' : 'none';
  }

  private ensureInitialized(width: number, height: number): void {
    if (this.renderer) return;

    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '3';
    this.parent.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const data = new Float32Array(MAX_METABALLS * 4);
    this.dataTexture = new THREE.DataTexture(
      data,
      MAX_METABALLS,
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.dataTexture.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_metaballs: { value: this.dataTexture },
        u_metaballCount: { value: 0 },
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_time: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.resize(width, height);
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
