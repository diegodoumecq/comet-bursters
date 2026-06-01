import { describe, expect, it } from 'vitest';

import type { SpaceWorldRuntime } from '../world/SpaceWorldRuntime';
import { DimensionCoordinator } from './DimensionCoordinator';
import type { PortalDirectorPlan, PortalEntity, SpaceId } from './types';

const TRANSFER_TEST_WORLD = { width: 800, height: 600 };

describe('DimensionCoordinator hidden-world cleanup', () => {
  it('cleans the rift when a window portal closes while the ship remains in rift', () => {
    const coordinator = new DimensionCoordinator();
    const arcade = createWorld('arcade');
    const rift = createWorld('rift');
    coordinator.registerWorld(arcade.runtime);
    coordinator.registerWorld(rift.runtime);

    coordinator.openPortal(createPlan({ viewPolicy: 'window' }));
    const commands = coordinator.updatePortalLifecycle(2000);

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
    coordinator.processPortalTransfers(500, TRANSFER_TEST_WORLD);
    const commands = coordinator.updatePortalLifecycle(2000);

    expect(commands).toContainEqual({ hiddenSpace: 'arcade', type: 'cleanupHiddenWorld' });
    expect(arcade.clearCount).toBe(1);
    expect(rift.clearCount).toBe(0);
  });

  it('preserves transferred player position past the portal plane', () => {
    const coordinator = new DimensionCoordinator();
    const arcade = createWorld('arcade', { snapshots: [] });
    const rift = createWorld('rift', {
      detachedEntity: {
        membership: { space: 'rift' },
        position: { x: 90, y: 100 },
      },
      snapshots: [
        {
          id: 'player',
          kind: 'player',
          membership: { space: 'rift' },
          position: { x: 110, y: 100 },
          previousPosition: { x: 90, y: 100 },
        },
      ],
    });
    coordinator.registerWorld(arcade.runtime);
    coordinator.registerWorld(rift.runtime);

    coordinator.openPortal(
      createPlan({
        lifecycle: 'active',
        openedAt: 0,
        viewPolicy: 'cameraTransfer',
      }),
    );
    coordinator.processPortalTransfers(500, TRANSFER_TEST_WORLD);

    expect(arcade.attached[0].entity.position).toEqual({ x: 110, y: 100 });
  });

  it('nudges transferred players only when they land exactly on the portal plane', () => {
    const coordinator = new DimensionCoordinator();
    const arcade = createWorld('arcade', { snapshots: [] });
    const rift = createWorld('rift', {
      detachedEntity: {
        membership: { space: 'rift' },
        position: { x: 90, y: 100 },
      },
      snapshots: [
        {
          id: 'player',
          kind: 'player',
          membership: { space: 'rift' },
          position: { x: 100, y: 100 },
          previousPosition: { x: 90, y: 100 },
        },
      ],
    });
    coordinator.registerWorld(arcade.runtime);
    coordinator.registerWorld(rift.runtime);

    coordinator.openPortal(
      createPlan({
        lifecycle: 'active',
        openedAt: 0,
        viewPolicy: 'cameraTransfer',
      }),
    );
    coordinator.processPortalTransfers(500, TRANSFER_TEST_WORLD);

    expect(arcade.attached[0].entity.position).toEqual({ x: 100.5, y: 100 });
  });

  it('unregisters only the matching world runtime', () => {
    const coordinator = new DimensionCoordinator();
    const staleRift = createWorld('rift');
    const liveRift = createWorld('rift');

    coordinator.registerWorld(liveRift.runtime);
    coordinator.unregisterWorld('rift', staleRift.runtime);

    expect(coordinator.requireWorld('rift')).toBe(liveRift.runtime);

    coordinator.unregisterWorld('rift', liveRift.runtime);

    expect(coordinator.getWorld('rift')).toBeNull();
  });

  it('requires both worlds before active portal gameplay', () => {
    const coordinator = new DimensionCoordinator();
    coordinator.registerWorld(createWorld('arcade').runtime);
    coordinator.openPortal(
      createPlan({
        lifecycle: 'active',
        openedAt: 0,
        viewPolicy: 'cameraTransfer',
      }),
    );

    expect(() => coordinator.processPortalTransfers(500, TRANSFER_TEST_WORLD)).toThrow(
      'Dimension world is not registered: rift',
    );
  });
});

type TestSnapshot = ReturnType<SpaceWorldRuntime['getTransferSnapshots']>[number];

function createWorld(
  space: SpaceId,
  options: {
    detachedEntity?: { membership: { space: SpaceId }; position: { x: number; y: number } };
    snapshots?: TestSnapshot[];
  } = {},
): {
  attached: Array<{ entity: { position: { x: number; y: number } }; kind: 'player' }>;
  clearCount: number;
  runtime: SpaceWorldRuntime;
} {
  const world = {
    attached: [] as Array<{ entity: { position: { x: number; y: number } }; kind: 'player' }>,
    clearCount: 0,
    runtime: {
      attachTransferredEntity: (entity: {
        entity: { position: { x: number; y: number } };
        kind: 'player';
      }) => {
        world.attached.push(entity);
      },
      clearNonShipEntities: () => {
        world.clearCount += 1;
      },
      detachTransferEntity: () => ({
        entity: options.detachedEntity ?? {
          membership: { space: 'arcade' },
          position: { x: 0, y: 0 },
        },
        kind: 'player',
      }),
      getTransferSnapshots: () =>
        options.snapshots ??
        (space === 'arcade'
          ? [
              {
                id: 'player',
                kind: 'player',
                membership: { space: 'arcade' },
                position: { x: 90, y: 100 },
                previousPosition: { x: 130, y: 100 },
              },
            ]
          : []),
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
