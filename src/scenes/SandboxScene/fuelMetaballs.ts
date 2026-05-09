import * as THREE from 'three';

import { getGameHeight, getGameWidth } from '@/state';

export type FuelMetaball = {
  x: number;
  y: number;
  radius: number;
  seed: number;
};

const MAX_METABALLS = 96;
const RENDER_SCALE = 0.75;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let material: THREE.ShaderMaterial | null = null;
let dataTexture: THREE.DataTexture | null = null;
let canvas: HTMLCanvasElement | null = null;

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

export function initFuelMetaballs(): void {
  if (renderer) {
    return;
  }

  canvas = document.createElement('canvas');
  const width = getGameWidth();
  const height = getGameHeight();
  const renderWidth = Math.max(1, Math.ceil(width * RENDER_SCALE));
  const renderHeight = Math.max(1, Math.ceil(height * RENDER_SCALE));
  canvas.width = renderWidth;
  canvas.height = renderHeight;

  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });
  renderer.setSize(renderWidth, renderHeight, false);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const data = new Float32Array(MAX_METABALLS * 4);
  dataTexture = new THREE.DataTexture(data, MAX_METABALLS, 1, THREE.RGBAFormat, THREE.FloatType);
  dataTexture.needsUpdate = true;

  material = new THREE.ShaderMaterial({
    uniforms: {
      u_metaballs: { value: dataTexture },
      u_metaballCount: { value: 0 },
      u_resolution: { value: new THREE.Vector2(renderWidth, renderHeight) },
      u_time: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
}

export function renderFuelMetaballs(
  ctx: CanvasRenderingContext2D,
  metaballs: FuelMetaball[],
  now: number,
): void {
  if (!renderer || !scene || !camera || !material || !dataTexture || !canvas) {
    return;
  }

  const width = getGameWidth();
  const height = getGameHeight();
  if (
    canvas.width !== Math.ceil(width * RENDER_SCALE) ||
    canvas.height !== Math.ceil(height * RENDER_SCALE)
  ) {
    resizeFuelMetaballs(width, height);
  }

  const count = Math.min(metaballs.length, MAX_METABALLS);
  if (count === 0) {
    return;
  }

  const data = dataTexture.image.data as Float32Array;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < count; i++) {
    const x = metaballs[i].x * RENDER_SCALE;
    const y = metaballs[i].y * RENDER_SCALE;
    const radius = metaballs[i].radius * RENDER_SCALE;
    const influenceRadius = radius * 4;
    minX = Math.min(minX, x - influenceRadius);
    minY = Math.min(minY, y - influenceRadius);
    maxX = Math.max(maxX, x + influenceRadius);
    maxY = Math.max(maxY, y + influenceRadius);

    data[i * 4] = x;
    data[i * 4 + 1] = y;
    data[i * 4 + 2] = radius;
    data[i * 4 + 3] = metaballs[i].seed;
  }

  material.uniforms.u_metaballCount.value = count;
  material.uniforms.u_time.value = now;
  dataTexture.needsUpdate = true;

  const scissorLeft = Math.max(0, Math.floor(minX));
  const scissorTop = Math.max(0, Math.floor(minY));
  const scissorRight = Math.min(canvas.width, Math.ceil(maxX));
  const scissorBottom = Math.min(canvas.height, Math.ceil(maxY));
  const scissorWidth = scissorRight - scissorLeft;
  const scissorHeight = scissorBottom - scissorTop;
  if (scissorWidth <= 0 || scissorHeight <= 0) {
    return;
  }

  renderer.clear();
  renderer.setScissorTest(true);
  renderer.setScissor(scissorLeft, canvas.height - scissorBottom, scissorWidth, scissorHeight);
  renderer.render(scene, camera);
  renderer.setScissorTest(false);
  ctx.drawImage(canvas, 0, 0, width, height);
}

export function resizeFuelMetaballs(width: number, height: number): void {
  if (!renderer || !canvas || !material) {
    return;
  }

  const renderWidth = Math.max(1, Math.ceil(width * RENDER_SCALE));
  const renderHeight = Math.max(1, Math.ceil(height * RENDER_SCALE));
  canvas.width = renderWidth;
  canvas.height = renderHeight;
  renderer.setSize(renderWidth, renderHeight, false);
  material.uniforms.u_resolution.value.set(renderWidth, renderHeight);
}

export function disposeFuelMetaballs(): void {
  renderer?.dispose();
  renderer = null;
  dataTexture?.dispose();
  dataTexture = null;
  material?.dispose();
  material = null;
  scene = null;
  camera = null;
  canvas = null;
}
