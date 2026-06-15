import type Phaser from 'phaser';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('three', () => {
  class MockObject3D {
    readonly children: MockObject3D[] = [];
    readonly position = { set: vi.fn() };
    readonly rotation = { x: 0, y: 0, z: 0 };

    add(child: MockObject3D): void {
      this.children.push(child);
    }

    lookAt(): void {}

    traverse(visitor: (object: MockObject3D) => void): void {
      visitor(this);
      for (const child of this.children) child.traverse(visitor);
    }
  }

  class MockGeometry {
    dispose = vi.fn();
  }

  class MockMaterial {
    dispose = vi.fn();
  }

  class MockMesh extends MockObject3D {
    constructor(
      readonly geometry: MockGeometry,
      readonly material: MockMaterial,
    ) {
      super();
    }
  }

  return {
    AdditiveBlending: 'AdditiveBlending',
    AmbientLight: MockObject3D,
    BoxGeometry: MockGeometry,
    BufferGeometry: MockGeometry,
    DirectionalLight: MockObject3D,
    EdgesGeometry: MockGeometry,
    Group: MockObject3D,
    LineBasicMaterial: MockMaterial,
    LineSegments: MockMesh,
    Material: MockMaterial,
    Mesh: MockMesh,
    MeshBasicMaterial: MockMaterial,
    MeshStandardMaterial: MockMaterial,
    Object3D: MockObject3D,
    PerspectiveCamera: MockObject3D,
    Scene: MockObject3D,
    SphereGeometry: MockGeometry,
    WebGLRenderer: class {
      dispose = vi.fn();
      forceContextLoss = vi.fn();
      render = vi.fn();
      setClearColor = vi.fn();
      setPixelRatio = vi.fn();
      setSize = vi.fn();
    },
  };
});

import { createMonolithCubeTexture, MONOLITH_CUBE_FRAME_COUNT } from './monolithCubeTexture';

describe('createMonolithCubeTexture', () => {
  beforeAll(() => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ height: 0, width: 0 })),
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('bakes shared monolith frames once per texture manager', () => {
    const textures = createTextureManager();
    const firstScene = createScene(textures);
    const secondScene = createScene(textures);

    createMonolithCubeTexture(firstScene);
    createMonolithCubeTexture(secondScene);
    firstScene.emitShutdown();
    secondScene.emitShutdown();

    expect(textures.createCanvas).toHaveBeenCalledTimes(MONOLITH_CUBE_FRAME_COUNT);
    expect(textures.remove).not.toHaveBeenCalled();
    expect(textures.exists('entity-monolith')).toBe(true);
  });

  it('rebuilds the shared frame set when it is incomplete', () => {
    const textures = createTextureManager();
    const scene = createScene(textures);

    createMonolithCubeTexture(scene);
    textures.remove('entity-monolith-12');
    createMonolithCubeTexture(scene);

    expect(textures.createCanvas).toHaveBeenCalledTimes(MONOLITH_CUBE_FRAME_COUNT * 2);
    expect(textures.remove).toHaveBeenCalledWith('entity-monolith');
    expect(textures.exists('entity-monolith-12')).toBe(true);
  });
});

type TextureManagerMock = Phaser.Textures.TextureManager & {
  createCanvas: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

type SceneMock = Phaser.Scene & {
  emitShutdown: () => void;
};

function createTextureManager(): TextureManagerMock {
  const keys = new Set<string>();
  const textures = {
    createCanvas: vi.fn((key: string) => {
      keys.add(key);
      return {
        context: {
          clearRect: vi.fn(),
          drawImage: vi.fn(),
        },
        refresh: vi.fn(),
      };
    }),
    exists: (key: string) => keys.has(key),
    remove: vi.fn((key: string) => {
      keys.delete(key);
    }),
  };
  return textures as unknown as TextureManagerMock;
}

function createScene(textures: TextureManagerMock): SceneMock {
  const shutdownCallbacks: Array<() => void> = [];
  return {
    emitShutdown: () => {
      for (const callback of shutdownCallbacks) callback();
    },
    events: {
      once: (event: string, callback: () => void) => {
        if (event === 'shutdown') shutdownCallbacks.push(callback);
      },
    },
    textures,
  } as unknown as SceneMock;
}
