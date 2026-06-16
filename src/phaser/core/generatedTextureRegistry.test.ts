import { describe, expect, it } from 'vitest';

import {
  ensureGeneratedTextureGroups,
  type GeneratedTextureGroup,
} from './generatedTextureRegistry';

describe('generated texture registry', () => {
  it('ensures groups in registry order and reports progress', async () => {
    const calls: string[] = [];
    const groups: GeneratedTextureGroup[] = [
      {
        cacheEntries: [],
        ensure: () => {
          calls.push('first');
        },
        key: 'first',
        label: 'First',
        textureKeys: [],
      },
      {
        cacheEntries: [],
        ensure: async () => {
          calls.push('second');
        },
        key: 'second',
        label: 'Second',
        textureKeys: [],
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
});
