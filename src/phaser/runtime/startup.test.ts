import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getArcadeRiftDebugEnabled,
  getSandboxFogEnabled,
  getSandboxPerfToggles,
  getStartingWave,
} from './startup';

type StorageSeed = Record<string, string>;

function createTestStorage(seed: StorageSeed = {}): Storage {
  const values = new Map(Object.entries(seed));
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

function stubStartupWindow(input: {
  localStorage?: StorageSeed;
  search?: string;
  sessionStorage?: StorageSeed;
}): void {
  vi.stubGlobal('window', {
    localStorage: createTestStorage(input.localStorage),
    location: { search: input.search ?? '' },
    sessionStorage: createTestStorage(input.sessionStorage),
  });
}

describe('phaser startup settings', () => {
  beforeEach(() => {
    stubStartupWindow({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads landing-page switches from localStorage', () => {
    stubStartupWindow({
      localStorage: {
        'comet-bursters-arcadeRiftDebug': 'true',
        'comet-bursters-fog-enabled': 'false',
        'comet-bursters-sandboxMinimap': 'false',
        'comet-bursters-sandboxNebulaBackground': 'false',
        'comet-bursters-sandboxNebulaRegions': '0',
        'comet-bursters-starting-wave': '12',
      },
    });

    expect(getStartingWave()).toBe(12);
    expect(getSandboxFogEnabled()).toBe(false);
    expect(getArcadeRiftDebugEnabled()).toBe(true);
    expect(getSandboxPerfToggles()).toMatchObject({
      minimap: false,
      nebulaBackground: false,
      nebulaRegions: false,
      threeBackground: false,
    });
  });

  it('keeps the old sandboxThreeBackground key as a nebula background alias', () => {
    stubStartupWindow({
      localStorage: {
        'comet-bursters-sandboxThreeBackground': 'false',
      },
    });

    expect(getSandboxPerfToggles()).toMatchObject({
      nebulaBackground: false,
      threeBackground: false,
    });
  });

  it('lets sessionStorage override localStorage for profiling runs', () => {
    stubStartupWindow({
      localStorage: {
        'comet-bursters-sandboxMinimap': 'false',
        'comet-bursters-starting-wave': '8',
      },
      sessionStorage: {
        'comet-bursters-sandboxMinimap': 'true',
        'comet-bursters-starting-wave': '2',
      },
    });

    expect(getStartingWave()).toBe(2);
    expect(getSandboxPerfToggles().minimap).toBe(true);
  });

  it('lets query params override stored startup switches', () => {
    stubStartupWindow({
      localStorage: {
        'comet-bursters-sandboxBlackHoles': 'true',
        'comet-bursters-sandboxMinimap': 'false',
      },
      search: '?sandboxBlackHoles=0&sandboxMinimap=true',
      sessionStorage: {
        'comet-bursters-sandboxMinimap': 'false',
      },
    });

    expect(getSandboxPerfToggles()).toMatchObject({
      blackHoles: false,
      minimap: true,
    });
  });
});
