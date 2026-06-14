import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createTestStorage(): Storage {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } as Storage;
}

describe('phaser runtime config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('phaser', () => ({
      default: {
        AUTO: 'AUTO',
        Scene: class Scene {},
        Scale: {
          CENTER_BOTH: 'CENTER_BOTH',
          RESIZE: 'RESIZE',
        },
      },
    }));
    vi.stubGlobal('window', {
      innerHeight: 720,
      innerWidth: 1280,
      localStorage: createTestStorage(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not enable the Phaser GamepadPlugin', async () => {
    const { createPhaserConfig } = await import('./config');
    const config = createPhaserConfig('app');

    expect(config.input).toMatchObject({
      gamepad: false,
    });
  });
});
