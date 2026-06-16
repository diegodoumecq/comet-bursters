import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('generated texture scopes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('keeps boot scope limited to player textures and keeps all entries valid for pruning', async () => {
    const { BOOT_GENERATED_TEXTURE_GROUPS } = await import('./boot/generatedTextures');
    const { getAllGeneratedTextureCacheEntries, getGeneratedTextureGroupsForScope } =
      await import('./generatedTextureScopes');

    expect(BOOT_GENERATED_TEXTURE_GROUPS.map((group) => group.key)).toEqual(['player']);
    expect(getGeneratedTextureGroupsForScope('arcade').map((group) => group.key)).toEqual([
      'asteroids',
      'entities',
    ]);
    expect(getGeneratedTextureGroupsForScope('rift-space').map((group) => group.key)).toEqual([
      'asteroids',
      'entities',
    ]);
    expect(getGeneratedTextureGroupsForScope('demo').map((group) => group.key)).toEqual([
      'asteroids',
      'entities',
    ]);
    expect(getGeneratedTextureGroupsForScope('sandbox').map((group) => group.key)).toEqual([
      'asteroids',
    ]);
    expect(getGeneratedTextureGroupsForScope('ship-interior')).toEqual([]);
    expect(
      getAllGeneratedTextureCacheEntries().some((entry) =>
        entry.textureKey.startsWith('phaser-asteroid-'),
      ),
    ).toBe(true);
    expect(
      getAllGeneratedTextureCacheEntries().some((entry) =>
        entry.textureKey.startsWith('entity-monolith'),
      ),
    ).toBe(true);
  });

  it('keeps focused demo profile scopes asteroid-only without changing pruning entries', async () => {
    vi.stubGlobal('window', { __demoPerfTechnique: 'planet-texture-cache' });
    const { getAllGeneratedTextureCacheEntries, getGeneratedTextureGroupsForScope } =
      await import('./generatedTextureScopes');

    expect(getGeneratedTextureGroupsForScope('demo').map((group) => group.key)).toEqual([
      'asteroids',
    ]);
    expect(
      getAllGeneratedTextureCacheEntries().some((entry) =>
        entry.textureKey.startsWith('entity-monolith'),
      ),
    ).toBe(true);
  });

  it('unloads demand textures after the final owning scene shuts down', async () => {
    vi.useFakeTimers();
    const {
      getGeneratedTextureGroupsForScope,
      getGeneratedTextureRuntimeStats,
      registerGeneratedTextureScope,
    } = await import('./generatedTextureScopes');
    const { collectGeneratedTextureKeys } = await import('../core/generatedTextureRegistry');
    const demandTextureKeys = collectGeneratedTextureKeys(
      getGeneratedTextureGroupsForScope('demo'),
    );
    const scene = createScene(demandTextureKeys);

    registerGeneratedTextureScope(scene, 'demo');
    expect(
      getGeneratedTextureRuntimeStats(scene).groups.filter((group) => group.refCount === 1).length,
    ).toBe(2);

    scene.emitShutdown();
    expect(scene.removedTextureKeys).toEqual([]);
    await vi.runOnlyPendingTimersAsync();

    expect(scene.removedTextureKeys.sort()).toEqual([...demandTextureKeys].sort());
  });

  it('cancels a pending unload when the scene restarts and registers the same scope again', async () => {
    vi.useFakeTimers();
    const {
      getGeneratedTextureGroupsForScope,
      getGeneratedTextureRuntimeStats,
      registerGeneratedTextureScope,
    } = await import('./generatedTextureScopes');
    const { collectGeneratedTextureKeys } = await import('../core/generatedTextureRegistry');
    const demandTextureKeys = collectGeneratedTextureKeys(
      getGeneratedTextureGroupsForScope('demo'),
    );
    const scene = createScene(demandTextureKeys);

    registerGeneratedTextureScope(scene, 'demo');
    scene.emitShutdown();
    registerGeneratedTextureScope(scene, 'demo');
    await vi.runOnlyPendingTimersAsync();

    expect(scene.removedTextureKeys).toEqual([]);
    expect(
      getGeneratedTextureRuntimeStats(scene).groups.filter((group) => group.refCount === 1).length,
    ).toBe(2);
  });

  it('registers and unloads only asteroid textures for sandbox', async () => {
    vi.useFakeTimers();
    const {
      getGeneratedTextureGroupsForScope,
      getGeneratedTextureRuntimeStats,
      registerGeneratedTextureScope,
    } = await import('./generatedTextureScopes');
    const { collectGeneratedTextureKeys } = await import('../core/generatedTextureRegistry');
    const sandboxTextureKeys = collectGeneratedTextureKeys(
      getGeneratedTextureGroupsForScope('sandbox'),
    );
    const scene = createScene(sandboxTextureKeys);

    registerGeneratedTextureScope(scene, 'sandbox');
    expect(
      getGeneratedTextureRuntimeStats(scene).groups.filter((group) => group.refCount === 1),
    ).toEqual([
      expect.objectContaining({
        groupKey: 'asteroids',
        loadedTextures: sandboxTextureKeys.length,
        textureCount: sandboxTextureKeys.length,
      }),
    ]);

    scene.emitShutdown();
    await vi.runOnlyPendingTimersAsync();

    expect(scene.removedTextureKeys.sort()).toEqual([...sandboxTextureKeys].sort());
    expect(
      scene.removedTextureKeys.some((textureKey) => textureKey.startsWith('entity-monolith')),
    ).toBe(false);
  });
});

type SceneStub = Phaser.Scene & {
  emitShutdown: () => void;
  removedTextureKeys: string[];
};

function createScene(existingTextureKeys: readonly string[]): SceneStub {
  let shutdownHandler: (() => void) | null = null;
  const keys = new Set(existingTextureKeys);
  const removedTextureKeys: string[] = [];
  return {
    emitShutdown: () => shutdownHandler?.(),
    events: {
      once: (_event: string, handler: () => void) => {
        shutdownHandler = handler;
      },
    },
    removedTextureKeys,
    textures: {
      exists: (textureKey: string) => keys.has(textureKey),
      remove: (textureKey: string) => {
        keys.delete(textureKey);
        removedTextureKeys.push(textureKey);
      },
    },
  } as unknown as SceneStub;
}
