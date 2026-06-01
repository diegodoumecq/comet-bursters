import { describe, expect, it, vi } from 'vitest';

import type { MatterImage } from '../core/types';
import type { SpaceId } from '../dimensions/types';
import type { PlayerBody } from '../player/body';
import { PlayerState } from '../player/state';
import { SpaceWorldRuntime } from './SpaceWorldRuntime';

describe('SpaceWorldRuntime player transfer authority', () => {
  it('uses the scene player body for transfer snapshots', () => {
    const player = createPlayer('arcade');
    const playerBody = createPlayerBodySync(player, {
      position: { x: 50, y: 60 },
      rotation: 1.25,
      velocity: { x: 7, y: 8 },
    });
    const runtime = createRuntime('arcade');
    runtime.attachPlayer(player, playerBody);

    const snapshot = runtime
      .getTransferSnapshots()
      .find((candidate) => candidate.kind === 'player');

    expect(snapshot?.position).toEqual({ x: 50, y: 60 });
    expect(player.velocity).toEqual({ x: 7, y: 8 });
  });

  it('detaches the player after saving the scene body impulse', () => {
    const player = createPlayer('arcade');
    const playerBody = createPlayerBodySync(player, {
      position: { x: 70, y: 80 },
      rotation: 0.5,
      velocity: { x: -4, y: 11 },
    });
    const runtime = createRuntime('arcade');
    runtime.attachPlayer(player, playerBody);

    const detached = runtime.detachTransferEntity({
      id: 'player',
      kind: 'player',
      membership: { space: 'arcade' },
      position: player.position,
      previousPosition: { x: 90, y: 80 },
    });

    expect(detached?.kind).toBe('player');
    expect(detached?.entity.position).toEqual({ x: 70, y: 80 });
    expect(detached?.entity.velocity).toEqual({ x: -4, y: 11 });
  });

  it('preserves incoming player momentum while attaching to a destination body', () => {
    const player = createPlayer('rift');
    player.position = { x: 140, y: 150 };
    player.velocity = { x: 9, y: -3 };
    player.rotation = 0.75;
    const playerBody = createPlayerBodyWithStateSync(player);
    const runtime = createRuntime('arcade');

    runtime.attachPlayer(player, playerBody);

    expect(playerBody.appliedVelocity).toEqual({ x: 9, y: -3 });
    expect(player.velocity).toEqual({ x: 9, y: -3 });
    expect(player.rotation).toBe(0.75);
  });

  it('preserves incoming player momentum when creating a fresh destination body', () => {
    const player = createPlayer('rift');
    player.position = { x: 220, y: 230 };
    player.velocity = { x: 12, y: -6 };
    player.rotation = 1.1;
    const playerBody = createPlayerBodyWithStateSync(player);
    const runtime = createRuntime('rift', {
      createPlayerBody: vi.fn(() => {
        playerBody.syncState();
        return playerBody;
      }),
    });

    runtime.attachPlayer(player);

    expect(playerBody.appliedVelocity).toEqual({ x: 12, y: -6 });
    expect(player.position).toEqual({ x: 220, y: 230 });
    expect(player.velocity).toEqual({ x: 12, y: -6 });
    expect(player.rotation).toBe(1.1);
  });
});

function createRuntime(
  space: SpaceId,
  overrides: Partial<ConstructorParameters<typeof SpaceWorldRuntime>[1]> = {},
): SpaceWorldRuntime {
  return new SpaceWorldRuntime(space, {
    asteroidBodies: {} as never,
    contacts: {
      setPlayer: vi.fn(),
      setShield: vi.fn(),
    } as never,
    fuelBlobViews: {} as never,
    particleViews: {} as never,
    persistentPlayerBody: true,
    projectileBodies: {} as never,
    ...overrides,
  });
}

function createPlayer(space: SpaceId): PlayerState {
  const player = new PlayerState();
  player.membership = { space };
  player.position = { x: 10, y: 20 };
  player.velocity = { x: 1, y: 2 };
  return player;
}

function createPlayerBodySync(
  player: PlayerState,
  state: {
    position: { x: number; y: number };
    rotation: number;
    velocity: { x: number; y: number };
  },
): PlayerBody {
  return {
    body: {
      body: { velocity: state.velocity },
      rotation: state.rotation,
      x: state.position.x,
      y: state.position.y,
    } as MatterImage,
    destroy: vi.fn(),
    setCollisionEnabled: vi.fn(),
    setPosition: vi.fn(),
    setRotation: vi.fn(),
    setVelocity: vi.fn(),
    setVisible: vi.fn(),
    shieldSensor: { body: {} },
    syncState: vi.fn(() => {
      player.position = { ...state.position };
      player.velocity = { ...state.velocity };
      player.rotation = state.rotation;
    }),
    updateShieldSensor: vi.fn(),
  } as unknown as PlayerBody;
}

function createPlayerBodyWithStateSync(player: PlayerState): PlayerBody & {
  appliedVelocity: { x: number; y: number };
} {
  const bodyState = {
    position: { x: 0, y: 0 },
    rotation: 0,
    velocity: { x: 0, y: 0 },
  };
  const playerBody = {
    appliedVelocity: { x: 0, y: 0 },
    body: {
      body: { velocity: bodyState.velocity },
      rotation: bodyState.rotation,
      x: bodyState.position.x,
      y: bodyState.position.y,
    } as MatterImage,
    destroy: vi.fn(),
    setCollisionEnabled: vi.fn(),
    setPosition: vi.fn((position: { x: number; y: number }) => {
      bodyState.position = { ...position };
      playerBody.syncState();
    }),
    setRotation: vi.fn((rotation: number) => {
      bodyState.rotation = rotation;
      playerBody.syncState();
    }),
    setVelocity: vi.fn((velocity: { x: number; y: number }) => {
      bodyState.velocity = { ...velocity };
      playerBody.appliedVelocity = { ...velocity };
      playerBody.syncState();
    }),
    setVisible: vi.fn(),
    shieldSensor: { body: {} },
    syncState: vi.fn(() => {
      player.position = { ...bodyState.position };
      player.velocity = { ...bodyState.velocity };
      player.rotation = bodyState.rotation;
    }),
    updateShieldSensor: vi.fn(),
  } as unknown as PlayerBody & { appliedVelocity: { x: number; y: number } };
  return playerBody;
}
