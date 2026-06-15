import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';

import { EntityBodies } from './bodies';
import type { GameEntity } from './types';

describe('EntityBodies rotation authority', () => {
  it('syncs live body rotation and spin into entity state', () => {
    const { body, scene, visual } = createSceneWithEntityBody();
    const bodies = new EntityBodies(scene);
    const entity = createEntity();

    bodies.add(entity);
    body.x = 25;
    body.y = 35;
    body.body.velocity = { x: 3, y: -4 };
    body.body.angle = 0.75;
    body.body.angularVelocity = -0.03;

    bodies.sync(entity);

    expect(entity.position).toEqual({ x: 25, y: 35 });
    expect(entity.velocity).toEqual({ x: 3, y: -4 });
    expect(entity.rotation).toBe(0.75);
    expect(entity.angularVelocity).toBe(-0.03);
    expect(visual.setRotation).toHaveBeenLastCalledWith(0.75);
  });

  it('preserves live body rotation and spin when detaching', () => {
    const { body, scene } = createSceneWithEntityBody();
    const bodies = new EntityBodies(scene);
    const entity = createEntity();

    bodies.add(entity);
    body.x = 50;
    body.y = 60;
    body.body.velocity = { x: -2, y: 6 };
    body.body.angle = 1.4;
    body.body.angularVelocity = 0.018;

    bodies.detach(entity);

    expect(entity.position).toEqual({ x: 50, y: 60 });
    expect(entity.velocity).toEqual({ x: -2, y: 6 });
    expect(entity.rotation).toBe(1.4);
    expect(entity.angularVelocity).toBe(0.018);
  });
});

type FakeMatterImage = {
  body: {
    angle: number;
    angularVelocity: number;
    collisionFilter: { category?: number; group?: number; mask?: number };
    id: number;
    velocity: { x: number; y: number };
  };
  destroy: ReturnType<typeof vi.fn>;
  setAngularVelocity: ReturnType<typeof vi.fn>;
  setBounce: ReturnType<typeof vi.fn>;
  setCircle: ReturnType<typeof vi.fn>;
  setDisplaySize: ReturnType<typeof vi.fn>;
  setFixedRotation: ReturnType<typeof vi.fn>;
  setFrictionAir: ReturnType<typeof vi.fn>;
  setMass: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setRotation: ReturnType<typeof vi.fn>;
  setVelocity: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  x: number;
  y: number;
};

type FakeVisual = {
  destroy: ReturnType<typeof vi.fn>;
  setDisplaySize: ReturnType<typeof vi.fn>;
  setName: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setRotation: ReturnType<typeof vi.fn>;
  setTexture: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  texture: { key: string };
};

function createEntity(): GameEntity {
  return {
    angularVelocity: 0,
    hits: 3,
    id: 42,
    kind: 'monolith',
    membership: { space: 'arcade' },
    position: { x: 10, y: 20 },
    rotation: 0,
    velocity: { x: 1, y: 2 },
  };
}

function createSceneWithEntityBody(): {
  body: FakeMatterImage;
  scene: Phaser.Scene;
  visual: FakeVisual;
} {
  const body = createFakeMatterImage();
  const visual = createFakeVisual();
  const scene = {
    add: {
      image: vi.fn(() => visual),
    },
    matter: {
      add: {
        image: vi.fn(() => body),
      },
    },
    time: {
      now: 0,
    },
  };
  return { body, scene: scene as unknown as Phaser.Scene, visual };
}

function createFakeMatterImage(): FakeMatterImage {
  const image = {
    body: {
      angle: 0,
      angularVelocity: 0,
      collisionFilter: {},
      id: 100,
      velocity: { x: 0, y: 0 },
    },
    destroy: vi.fn(),
    setAngularVelocity: vi.fn((value: number) => {
      image.body.angularVelocity = value;
      return image;
    }),
    setBounce: vi.fn(() => image),
    setCircle: vi.fn(() => image),
    setDisplaySize: vi.fn(() => image),
    setFixedRotation: vi.fn(() => image),
    setFrictionAir: vi.fn(() => image),
    setMass: vi.fn(() => image),
    setPosition: vi.fn((x: number, y: number) => {
      image.x = x;
      image.y = y;
      return image;
    }),
    setRotation: vi.fn((value: number) => {
      image.body.angle = value;
      return image;
    }),
    setVelocity: vi.fn((x: number, y: number) => {
      image.body.velocity = { x, y };
      return image;
    }),
    setVisible: vi.fn(() => image),
    x: 0,
    y: 0,
  };
  return image;
}

function createFakeVisual(): FakeVisual {
  const visual = {
    destroy: vi.fn(),
    setDisplaySize: vi.fn(() => visual),
    setName: vi.fn(() => visual),
    setPosition: vi.fn(() => visual),
    setRotation: vi.fn(() => visual),
    setTexture: vi.fn((key: string) => {
      visual.texture.key = key;
      return visual;
    }),
    setVisible: vi.fn(() => visual),
    texture: { key: 'entity-monolith' },
  };
  return visual;
}
