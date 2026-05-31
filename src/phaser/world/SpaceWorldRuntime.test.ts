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
});

function createRuntime(space: SpaceId): SpaceWorldRuntime {
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
