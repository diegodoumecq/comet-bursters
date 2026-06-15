import Phaser from 'phaser';
import * as THREE from 'three';

import { ENTITIES } from './config';

const MONOLITH_TEXTURE_SCALE = 2;
export const MONOLITH_CUBE_FRAME_COUNT = 24;
const MONOLITH_TILT_X = -0.46;
const MONOLITH_TILT_Z = 0.18;
const MONOLITH_CUBE_HALF_SIZE = 0.75;

export const MONOLITH_CUBE_TEXTURE_KEY = 'entity-monolith';
export const MONOLITH_CUBE_ANIMATION_FRAME_MS = 72;

export function createMonolithCubeTexture(scene: Phaser.Scene): void {
  if (!hasMonolithCubeTextures(scene)) bakeMonolithCubeTextures(scene);
}

export function getMonolithCubeTextureKey(frameIndex: number): string {
  const normalizedIndex = positiveModulo(Math.floor(frameIndex), MONOLITH_CUBE_FRAME_COUNT);
  return normalizedIndex === 0
    ? MONOLITH_CUBE_TEXTURE_KEY
    : `${MONOLITH_CUBE_TEXTURE_KEY}-${normalizedIndex}`;
}

export function getMonolithCubeAnimationFrame(timeMs: number, phase = 0): number {
  return positiveModulo(
    Math.floor(timeMs / MONOLITH_CUBE_ANIMATION_FRAME_MS) + phase,
    MONOLITH_CUBE_FRAME_COUNT,
  );
}

function hasMonolithCubeTextures(scene: Phaser.Scene): boolean {
  for (let frameIndex = 0; frameIndex < MONOLITH_CUBE_FRAME_COUNT; frameIndex += 1) {
    if (!scene.textures.exists(getMonolithCubeTextureKey(frameIndex))) return false;
  }
  return true;
}

function bakeMonolithCubeTextures(scene: Phaser.Scene): void {
  const size = ENTITIES.monolith.size;
  const renderer = new MonolithCubeTextureRenderer(size);
  try {
    for (let frameIndex = 0; frameIndex < MONOLITH_CUBE_FRAME_COUNT; frameIndex += 1) {
      const key = getMonolithCubeTextureKey(frameIndex);
      if (scene.textures.exists(key)) {
        scene.textures.remove(key);
      }
      const texture = scene.textures.createCanvas(key, size, size);
      if (!texture) throw new Error(`Unable to create canvas texture ${key}`);
      renderer.render(texture, frameIndex / MONOLITH_CUBE_FRAME_COUNT);
    }
  } finally {
    renderer.dispose();
  }
}

class MonolithCubeTextureRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cube: THREE.Group;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();

  constructor(private readonly size: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size * MONOLITH_TEXTURE_SCALE;
    this.canvas.height = size * MONOLITH_TEXTURE_SCALE;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      depth: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      stencil: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.canvas.width, this.canvas.height, false);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10);
    this.camera.position.set(0, 0, 4.1);
    this.camera.lookAt(0, 0, 0);

    this.cube = createMonolithCube();
    this.scene.add(this.cube);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(-3, 3, 4);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8fe9ff, 0.35);
    fillLight.position.set(2, -2, 1);
    this.scene.add(fillLight);
  }

  render(texture: Phaser.Textures.CanvasTexture, progress: number): void {
    this.cube.rotation.x = MONOLITH_TILT_X;
    this.cube.rotation.y = progress * Math.PI * 2;
    this.cube.rotation.z = MONOLITH_TILT_Z;
    this.renderer.render(this.scene, this.camera);

    const { context } = texture;
    context.clearRect(0, 0, this.size, this.size);
    context.drawImage(this.canvas, 0, 0, this.size, this.size);
    texture.refresh();
  }

  dispose(): void {
    this.scene.traverse(disposeSceneObject);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

type DisposableSceneObject = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

function disposeSceneObject(object: THREE.Object3D): void {
  const disposable = object as DisposableSceneObject;
  disposable.geometry?.dispose();
  disposeMaterial(disposable.material);
}

function disposeMaterial(material: THREE.Material | THREE.Material[] | undefined): void {
  if (Array.isArray(material)) {
    for (const current of material) current.dispose();
  } else {
    material?.dispose();
  }
}

function createMonolithCube(): THREE.Group {
  const group = new THREE.Group();
  const size = MONOLITH_CUBE_HALF_SIZE * 2;
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color: 0x03050a,
    emissive: 0x04070c,
    metalness: 0.55,
    roughness: 0.34,
  });
  const cube = new THREE.Mesh(geometry, material);
  group.add(cube);

  const edgeGlowMaterial = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: 0x7ee7ff,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.55,
  });
  const edgeCoreMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 1,
  });
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), edgeGlowMaterial));
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), edgeCoreMaterial));

  return group;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
