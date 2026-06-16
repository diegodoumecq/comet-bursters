import { describe, expect, it } from 'vitest';

import {
  collectGeneratedTextureCacheEntries,
  collectGeneratedTextureKeys,
  ensureGeneratedTextureGroups,
  type GeneratedTextureGroup,
} from './generatedTextureRegistry';

describe('generated texture registry', () => {
  it('ensures groups in registry order and reports progress', async () => {
    const calls: string[] = [];
    const groups: GeneratedTextureGroup[] = [
      {
        ensure: () => {
          calls.push('first');
        },
        key: 'first',
        label: 'First',
      },
      {
        ensure: async () => {
          calls.push('second');
        },
        key: 'second',
        label: 'Second',
      },
    ];

    await ensureGeneratedTextureGroups({} as Phaser.Scene, groups, {
      onGroupComplete: async ({ group }) => {
        calls.push(`complete:${group.key}`);
      },
      onGroupStart: async ({ group }) => {
        calls.push(`start:${group.key}`);
      },
    });

    expect(calls).toEqual([
      'start:first',
      'first',
      'complete:first',
      'start:second',
      'second',
      'complete:second',
    ]);
  });

  it('collects cache entries declared by generated texture groups', () => {
    const groups: GeneratedTextureGroup[] = [
      {
        cacheEntries: () => [{ textureKey: 'ship', version: 'v2' }],
        ensure: () => {},
        key: 'player',
        label: 'Player',
      },
      {
        cacheEntries: () => [
          { textureKey: 'asteroid-0', version: 'v1' },
          { textureKey: 'asteroid-1', version: 'v1' },
        ],
        ensure: () => {},
        key: 'asteroids',
        label: 'Asteroids',
      },
      {
        ensure: () => {},
        key: 'runtime-only',
        label: 'Runtime only',
      },
    ];

    expect(collectGeneratedTextureCacheEntries(groups)).toEqual([
      { textureKey: 'ship', version: 'v2' },
      { textureKey: 'asteroid-0', version: 'v1' },
      { textureKey: 'asteroid-1', version: 'v1' },
    ]);
  });

  it('collects explicit texture keys and falls back to cache entry keys', () => {
    const groups: GeneratedTextureGroup[] = [
      {
        cacheEntries: () => [{ textureKey: 'atlas-cache-key', version: 'v1' }],
        ensure: () => {},
        key: 'atlas',
        label: 'Atlas',
        textureKeys: () => ['atlas-runtime-key'],
      },
      {
        cacheEntries: () => [{ textureKey: 'image-cache-key', version: 'v1' }],
        ensure: () => {},
        key: 'image',
        label: 'Image',
      },
    ];

    expect(collectGeneratedTextureKeys(groups)).toEqual(['atlas-runtime-key', 'image-cache-key']);
  });
});
