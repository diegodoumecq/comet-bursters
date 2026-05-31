import { describe, expect, it } from 'vitest';

import type { SpaceWorldRuntime } from '../world/SpaceWorldRuntime';
import { DimensionCoordinator } from './DimensionCoordinator';
import type { PortalDirectorPlan, PortalEntity, SpaceId } from './types';

describe('DimensionCoordinator hidden-world cleanup', () => {
  it('cleans the rift when a window portal closes while the ship remains in rift', () => {
    const coordinator = new DimensionCoordinator();
    const arcade = createWorld('arcade');
    const rift = createWorld('rift');
    coordinator.registerWorld(arcade.runtime);
    coordinator.registerWorld(rift.runtime);

    coordinator.openPortal(createPlan({ viewPolicy: 'window' }));
    const commands = coordinator.update(2000);

    expect(commands).toContainEqual({ hiddenSpace: 'rift', type: 'cleanupHiddenWorld' });
    expect(arcade.clearCount).toBe(0);
    expect(rift.clearCount).toBe(1);
  });

  it('cleans arcade after a camera-transfer portal has made rift visible', () => {
    const coordinator = new DimensionCoordinator();
    const arcade = createWorld('arcade');
    const rift = createWorld('rift');
    coordinator.registerWorld(arcade.runtime);
    coordinator.registerWorld(rift.runtime);

    coordinator.openPortal(
      createPlan({
        lifecycle: 'active',
        openedAt: 0,
        viewPolicy: 'cameraTransfer',
      }),
    );
    coordinator.update(500);
    const commands = coordinator.update(2000);

    expect(commands).toContainEqual({ hiddenSpace: 'arcade', type: 'cleanupHiddenWorld' });
    expect(arcade.clearCount).toBe(1);
    expect(rift.clearCount).toBe(0);
  });
});

function createWorld(space: SpaceId): { clearCount: number; runtime: SpaceWorldRuntime } {
  const world = {
    clearCount: 0,
    runtime: {
      attachTransferredEntity: () => {},
      clearNonShipEntities: () => {
        world.clearCount += 1;
      },
      detachTransferEntity: () => ({ entity: { membership: { space: 'arcade' } }, kind: 'player' }),
      getTransferSnapshots: () =>
        space === 'arcade'
          ? [
              {
                id: 'player',
                kind: 'player',
                membership: { space: 'arcade' },
                position: { x: 90, y: 100 },
                previousPosition: { x: 130, y: 100 },
              },
            ]
          : [],
      space,
      syncPreviousPositions: () => {},
    } as unknown as SpaceWorldRuntime,
  };
  return world;
}

function createPlan(input: Partial<PortalEntity>): PortalDirectorPlan {
  return {
    portal: {
      activeDurationMs: 800,
      aperture: { radiusX: 80, radiusY: 40 },
      closeStartedAt: 1000,
      closingDurationMs: 400,
      id: 1,
      lifecycle: input.lifecycle ?? 'closingVisual',
      normal: { x: 1, y: 0 },
      openedAt: input.openedAt ?? -200,
      openingDurationMs: 200,
      position: { x: 100, y: 100 },
      viewPolicy: input.viewPolicy ?? 'window',
      visualRadiusX: 100,
      visualRadiusY: 50,
    },
    spawn: {
      asteroidCount: 0,
      asteroidSpeed: 0,
      spawnDistance: 0,
      spreadRadius: 0,
    },
  };
}
