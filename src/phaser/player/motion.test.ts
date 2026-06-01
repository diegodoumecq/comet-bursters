import { describe, expect, it, vi } from 'vitest';

import type { MatterImage } from '../core/types';
import { PLAYER_ACCELERATION, PLAYER_MAX_SPEED } from './config';
import { applyPlayerThrust, updatePlayerStateMotion } from './motion';
import type { ShipState } from './shipState';
import type { PlayerState } from './state';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Vector2: class Vector2 {
        constructor(
          readonly x: number,
          readonly y: number,
        ) {}
      },
    },
  },
}));

function createBody(input: { mass?: number; velocity?: { x: number; y: number } } = {}) {
  const forces: Array<{ x: number; y: number }> = [];
  const body = {
    body: {
      mass: input.mass ?? 2,
      velocity: input.velocity ?? { x: 0, y: 0 },
    },
    applyForce(force: { x: number; y: number }) {
      forces.push({ x: force.x, y: force.y });
    },
    setVelocity(x: number, y: number) {
      this.body.velocity = { x, y };
    },
  };

  return { body: body as unknown as MatterImage, forces };
}

describe('Phaser player motion tuning', () => {
  it('uses canvas-equivalent ship tuning', () => {
    expect(PLAYER_ACCELERATION).toBe(360);
    expect(PLAYER_MAX_SPEED).toBe(25);
  });

  it('applies thrust from the tuned acceleration constant', () => {
    const { body, forces } = createBody({ mass: 2 });

    applyPlayerThrust(body, { x: 1, y: 0 }, 100, 1 / 60);

    expect(forces).toEqual([{ x: PLAYER_ACCELERATION * 2 * 0.000001, y: 0 }]);
  });

  it('caps velocity at the tuned max speed without changing direction', () => {
    const { body } = createBody({ velocity: { x: 30, y: 40 } });

    applyPlayerThrust(body, { x: 0, y: 0 }, 100, 1 / 60);

    expect(body.body.velocity.x).toBeCloseTo(15);
    expect(body.body.velocity.y).toBeCloseTo(20);
    expect(Math.hypot(body.body.velocity.x, body.body.velocity.y)).toBeCloseTo(PLAYER_MAX_SPEED);
  });

  it('supports scene-local motion tuning overrides', () => {
    const { body, forces } = createBody({ mass: 2, velocity: { x: 60, y: 80 } });

    applyPlayerThrust(body, { x: 1, y: 0 }, 100, 1 / 60, {
      acceleration: 720,
      maxSpeed: 50,
    });

    expect(forces).toEqual([{ x: 720 * 2 * 0.000001, y: 0 }]);
    expect(body.body.velocity.x).toBeCloseTo(30);
    expect(body.body.velocity.y).toBeCloseTo(40);
    expect(Math.hypot(body.body.velocity.x, body.body.velocity.y)).toBeCloseTo(50);
  });

  it('updates player state directly for non-Matter spaces', () => {
    const player = {
      position: { x: 10, y: 20 },
      rotation: 0,
      updateThrust: vi.fn(),
      velocity: { x: 1, y: 0 },
    } as unknown as PlayerState;
    const ship = {
      fuel: 100,
      setFuel: vi.fn((fuel: number) => {
        ship.fuel = fuel;
      }),
    } as unknown as ShipState;

    updatePlayerStateMotion({
      deltaSeconds: 1 / 60,
      move: { x: 1, y: 0 },
      player,
      ship,
      tuning: { acceleration: PLAYER_ACCELERATION, maxSpeed: PLAYER_MAX_SPEED },
      world: { width: 1000, height: 1000 },
      wrap: false,
    });

    expect(player.position.x).toBeGreaterThan(11);
    expect(player.position.y).toBe(20);
    expect(player.rotation).toBeCloseTo(0);
    expect(player.updateThrust).toHaveBeenCalledWith({ x: 1, y: 0 }, true);
    expect(ship.setFuel).toHaveBeenCalled();
  });

  it('uses world heading as player rotation', () => {
    const player = {
      position: { x: 10, y: 20 },
      rotation: 0,
      updateThrust: vi.fn(),
      velocity: { x: 0, y: 0 },
    } as unknown as PlayerState;
    const ship = {
      fuel: 100,
      setFuel: vi.fn((fuel: number) => {
        ship.fuel = fuel;
      }),
    } as unknown as ShipState;

    updatePlayerStateMotion({
      deltaSeconds: 1 / 60,
      move: { x: 0, y: 1 },
      player,
      ship,
      tuning: { acceleration: PLAYER_ACCELERATION, maxSpeed: PLAYER_MAX_SPEED },
      world: { width: 1000, height: 1000 },
      wrap: false,
    });

    expect(player.rotation).toBeCloseTo(Math.PI * 0.5);
  });
});
