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

  it('prepares a scope and reports loaded runtime texture counts', async () => {
    const {
      ensureGeneratedTextureScope,
      getGeneratedTextureGroupsForScope,
      getGeneratedTextureRuntimeStats,
    } = await import('./generatedTextureScopes');
    const groups = getGeneratedTextureGroupsForScope('demo');
    const demandTextureKeys = groups.flatMap((group) => [...group.textureKeys]);
    const calls: string[] = [];
    const scene = createScene(demandTextureKeys);

    await ensureGeneratedTextureScope(scene, 'demo', {
      onGroupComplete: ({ group }) => {
        calls.push(`complete:${group.key}`);
      },
      onGroupStart: ({ group }) => {
        calls.push(`start:${group.key}`);
      },
    });

    expect(calls).toEqual([
      'start:asteroids',
      'complete:asteroids',
      'start:entities',
      'complete:entities',
    ]);
    expect(getGeneratedTextureRuntimeStats(scene).groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupKey: 'asteroids',
          loadedTextures: groups[0].textureKeys.length,
          textureCount: groups[0].textureKeys.length,
        }),
        expect.objectContaining({
          groupKey: 'entities',
          loadedTextures: groups[1].textureKeys.length,
          textureCount: groups[1].textureKeys.length,
        }),
      ]),
    );
  });

  it('prepares only asteroid textures for sandbox', async () => {
    const {
      ensureGeneratedTextureScope,
      getGeneratedTextureGroupsForScope,
      getGeneratedTextureRuntimeStats,
    } = await import('./generatedTextureScopes');
    const groups = getGeneratedTextureGroupsForScope('sandbox');
    const sandboxTextureKeys = groups.flatMap((group) => [...group.textureKeys]);
    const scene = createScene(sandboxTextureKeys);

    await ensureGeneratedTextureScope(scene, 'sandbox');

    expect(
      getGeneratedTextureRuntimeStats(scene).groups.filter((group) => group.loadedTextures > 0),
    ).toEqual([
      expect.objectContaining({
        groupKey: 'asteroids',
        loadedTextures: sandboxTextureKeys.length,
        textureCount: sandboxTextureKeys.length,
      }),
    ]);
  });
});

type SceneStub = Phaser.Scene & {
  readonly existingTextureKeys: Set<string>;
};

function createScene(existingTextureKeys: readonly string[]): SceneStub {
  const keys = new Set(existingTextureKeys);
  return {
    existingTextureKeys: keys,
    textures: {
      exists: (textureKey: string) => keys.has(textureKey),
    },
  } as unknown as SceneStub;
}
