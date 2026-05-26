import * as THREE from 'three';

import { BLACK_HOLE_RADIUS, DISTORTION_RADIUS, DISTORTION_STRENGTH } from '@/constants';
import { getGameHeight, getGameWidth } from '@/state';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let material: THREE.ShaderMaterial;
let mesh: THREE.Mesh;
let initialized = false;
let glCanvas: HTMLCanvasElement | null = null;
let currentTexture: THREE.CanvasTexture | null = null;
let bhDataTexture: THREE.DataTexture | null = null;
let webglSupported = true;

export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const MAX_BLACK_HOLES = 32;

const fragmentShader = `
precision highp float;

uniform sampler2D u_texture;
uniform sampler2D u_bhPositions;
uniform float u_distortionRadius;
uniform float u_distortionStrength;
uniform int u_blackHoleCount;
uniform vec2 u_resolution;

varying vec2 vUv;

void main() {
  vec2 pixelPos = vUv * u_resolution;
  vec4 color = texture2D(u_texture, vUv);
  
  // Pass 1: Apply distortion sequentially
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
      vec2 diff = currentPos - bhPos;
      float t = 1.0 - (dist - blackHoleRadius) / (distortionRadius - blackHoleRadius);
      float bendStrength = pow(t, 2.0) * u_distortionStrength;
      
      currentPos = currentPos + normalize(diff) * bendStrength * 30.0;
      vec2 distortedUV = currentPos / u_resolution;
      
      color = texture2D(u_texture, distortedUV);
      
      // Purple tint effect - disabled because it causes black holes to distort each other
      // if (dist < u_blackHoleRadius * 2.5) {
      //   float tintStrength = 1.0 - (dist - u_blackHoleRadius) / (u_blackHoleRadius * 1.5);
      //   color.rgb = mix(color.rgb, vec3(0.6, 0.3, 1.0), tintStrength * 0.5);
      // }
    }
  }
  
  // Pass 2: Check all centers (no distortion)
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
  
  // Pass 3: Check all borders (no distortion)
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
  
  // Pass 4: Purple glow (no distortion)
  for (int i = 0; i < ${MAX_BLACK_HOLES}; i++) {
    if (i >= u_blackHoleCount) break;
    
    vec2 bhUV = vec2((float(i) + 0.5) / float(${MAX_BLACK_HOLES}), 0.5);
    vec4 bhData = texture2D(u_bhPositions, bhUV);
    vec2 bhPos = bhData.xy;
    float blackHoleRadius = bhData.z;
    float dist = length(pixelPos - bhPos);
    
    if (dist >= blackHoleRadius && dist < blackHoleRadius * 2.5) {
      float tintStrength = 1.0 - (dist - blackHoleRadius) / (blackHoleRadius * 1.5);
      color.rgb = mix(color.rgb, vec3(0.6, 0.3, 1.0), tintStrength * 0.5);
    }
  }
  
  gl_FragColor = color;
}
`;

export function initShader(gameCanvas: HTMLCanvasElement): void {
  if (initialized) return;

  webglSupported = isWebGLSupported();
  if (!webglSupported) {
    console.warn('WebGL not supported, skipping shader initialization');
    return;
  }

  const parent = gameCanvas.parentElement!;
  const width = getGameWidth();
  const height = getGameHeight();

  glCanvas = document.createElement('canvas');
  glCanvas.width = width;
  glCanvas.height = height;
  glCanvas.style.position = 'absolute';
  glCanvas.style.top = '0';
  glCanvas.style.left = '0';
  glCanvas.style.pointerEvents = 'none';
  glCanvas.style.zIndex = '2';
  glCanvas.style.background = 'transparent';
  parent.appendChild(glCanvas);

  renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene = new THREE.Scene();

  const bhData = new Float32Array(MAX_BLACK_HOLES * 4);
  bhDataTexture = new THREE.DataTexture(
    bhData,
    MAX_BLACK_HOLES,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  bhDataTexture.needsUpdate = true;

  material = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: null },
      u_bhPositions: { value: bhDataTexture },
      u_distortionRadius: { value: DISTORTION_RADIUS },
      u_distortionStrength: { value: DISTORTION_STRENGTH },
      u_blackHoleCount: { value: 0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
    },
    vertexShader,
    fragmentShader,
    transparent: false,
  });

  const planeGeo = new THREE.PlaneGeometry(2, 2);
  mesh = new THREE.Mesh(planeGeo, material);
  scene.add(mesh);

  initialized = true;
}

export function updateBlackHoles(blackHoles: { x: number; y: number; radius?: number }[]): void {
  if (!initialized || !bhDataTexture) return;

  const count = Math.min(blackHoles.length, MAX_BLACK_HOLES);
  material.uniforms.u_blackHoleCount.value = count;

  const bhData = bhDataTexture.image.data as Float32Array;
  const height = getGameHeight();
  for (let i = 0; i < count; i++) {
    bhData[i * 4 + 0] = blackHoles[i].x;
    bhData[i * 4 + 1] = height - blackHoles[i].y;
    bhData[i * 4 + 2] = blackHoles[i].radius ?? BLACK_HOLE_RADIUS;
    bhData[i * 4 + 3] = (blackHoles[i].radius ?? BLACK_HOLE_RADIUS) / BLACK_HOLE_RADIUS;
  }

  bhDataTexture.needsUpdate = true;
}

export function renderWithShaders(gameCanvas: HTMLCanvasElement): void {
  if (!initialized || !renderer) return;

  if (!currentTexture) {
    currentTexture = new THREE.CanvasTexture(gameCanvas);
    currentTexture.minFilter = THREE.LinearFilter;
    currentTexture.magFilter = THREE.LinearFilter;
    material.uniforms.u_texture.value = currentTexture;
  }
  currentTexture.needsUpdate = true;

  renderer.clear();
  renderer.render(scene, camera);
}

export function isInitialized(): boolean {
  return initialized;
}

export function areShadersSupported(): boolean {
  return webglSupported;
}

export function resize(newWidth: number, newHeight: number): void {
  if (renderer && glCanvas) {
    glCanvas.width = newWidth;
    glCanvas.height = newHeight;
    renderer.setSize(newWidth, newHeight);
    if (material) {
      material.uniforms.u_resolution.value.set(newWidth, newHeight);
    }
  }
}

export function dispose(): void {
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  if (currentTexture) {
    currentTexture.dispose();
    currentTexture = null;
  }
  if (bhDataTexture) {
    bhDataTexture.dispose();
    bhDataTexture = null;
  }
  if (glCanvas && glCanvas.parentElement) {
    glCanvas.parentElement.removeChild(glCanvas);
    glCanvas = null;
  }
  initialized = false;
}
