import * as THREE from 'three';

import {
  BLACK_HOLE_RADIUS,
  COLOR_GRADE_PRESETS,
  DISTORTION_RADIUS,
  DISTORTION_STRENGTH,
} from '@/constants';
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
uniform float u_blackHoleRadius;
uniform float u_distortionRadius;
uniform float u_distortionStrength;
uniform int u_blackHoleCount;
uniform vec2 u_resolution;

uniform vec3 u_lift;
uniform vec3 u_gamma;
uniform vec3 u_gain;
uniform float u_saturation;
uniform float u_contrast;
uniform float u_brightness;

varying vec2 vUv;

vec3 applyColorGrading(vec3 color) {
  color = color + u_brightness;
  color = (color - 0.5) * u_contrast + 0.5;
  color = color + u_lift * (1.0 - color);
  color = color * u_gain;
  color = pow(max(color, vec3(0.0)), 1.0 / u_gamma);
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(lum), color, u_saturation);
  return clamp(color, 0.0, 1.0);
}

void main() {
  vec2 pixelPos = vUv * u_resolution;
  vec4 color = texture2D(u_texture, vUv);
  
  // Pass 1: Apply distortion sequentially
  vec2 currentPos = pixelPos;
  
  for (int i = 0; i < ${MAX_BLACK_HOLES}; i++) {
    if (i >= u_blackHoleCount) break;
    
    vec2 bhUV = vec2((float(i) + 0.5) / float(${MAX_BLACK_HOLES}), 0.5);
    vec2 bhPos = texture2D(u_bhPositions, bhUV).xy;
    float dist = length(currentPos - bhPos);
    
    if (dist >= u_blackHoleRadius && dist < u_distortionRadius) {
      vec2 diff = currentPos - bhPos;
      float t = 1.0 - (dist - u_blackHoleRadius) / (u_distortionRadius - u_blackHoleRadius);
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
    vec2 bhPos = texture2D(u_bhPositions, bhUV).xy;
    float dist = length(pixelPos - bhPos);
    
    if (dist < u_blackHoleRadius) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
  }
  
  // Pass 3: Check all borders (no distortion)
  for (int i = 0; i < ${MAX_BLACK_HOLES}; i++) {
    if (i >= u_blackHoleCount) break;
    
    vec2 bhUV = vec2((float(i) + 0.5) / float(${MAX_BLACK_HOLES}), 0.5);
    vec2 bhPos = texture2D(u_bhPositions, bhUV).xy;
    float dist = length(pixelPos - bhPos);
    
    if (dist >= u_blackHoleRadius && dist < u_blackHoleRadius + 1.0) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      return;
    }
  }
  
  // Pass 4: Purple glow (no distortion)
  for (int i = 0; i < ${MAX_BLACK_HOLES}; i++) {
    if (i >= u_blackHoleCount) break;
    
    vec2 bhUV = vec2((float(i) + 0.5) / float(${MAX_BLACK_HOLES}), 0.5);
    vec2 bhPos = texture2D(u_bhPositions, bhUV).xy;
    float dist = length(pixelPos - bhPos);
    
    if (dist >= u_blackHoleRadius && dist < u_blackHoleRadius * 2.5) {
      float tintStrength = 1.0 - (dist - u_blackHoleRadius) / (u_blackHoleRadius * 1.5);
      color.rgb = mix(color.rgb, vec3(0.6, 0.3, 1.0), tintStrength * 0.5);
    }
  }
  
  color.rgb = applyColorGrading(color.rgb);
  
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
      u_blackHoleRadius: { value: BLACK_HOLE_RADIUS },
      u_distortionRadius: { value: DISTORTION_RADIUS },
      u_distortionStrength: { value: DISTORTION_STRENGTH },
      u_blackHoleCount: { value: 0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_lift: { value: new THREE.Vector3(0, 0, 0) },
      u_gamma: { value: new THREE.Vector3(1, 1, 1) },
      u_gain: { value: new THREE.Vector3(1, 1, 1) },
      u_saturation: { value: 1.0 },
      u_contrast: { value: 1.0 },
      u_brightness: { value: 0.0 },
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

export function setColorGradePreset(preset: keyof typeof COLOR_GRADE_PRESETS): void {
  if (!initialized) return;

  const p = COLOR_GRADE_PRESETS[preset];
  material.uniforms.u_lift.value.set(p.lift[0], p.lift[1], p.lift[2]);
  material.uniforms.u_gamma.value.set(p.gamma[0], p.gamma[1], p.gamma[2]);
  material.uniforms.u_gain.value.set(p.gain[0], p.gain[1], p.gain[2]);
  material.uniforms.u_saturation.value = p.saturation;
  material.uniforms.u_contrast.value = p.contrast;
  material.uniforms.u_brightness.value = p.brightness;
}

export function updateBlackHoles(blackHoles: { x: number; y: number }[]): void {
  if (!initialized || !bhDataTexture) return;

  const count = Math.min(blackHoles.length, MAX_BLACK_HOLES);
  material.uniforms.u_blackHoleCount.value = count;

  const bhData = bhDataTexture.image.data as Float32Array;
  const height = getGameHeight();
  for (let i = 0; i < count; i++) {
    bhData[i * 4 + 0] = blackHoles[i].x;
    bhData[i * 4 + 1] = height - blackHoles[i].y;
    bhData[i * 4 + 2] = 0;
    bhData[i * 4 + 3] = 0;
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
