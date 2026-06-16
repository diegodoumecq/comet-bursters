import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PNG_CONTENT_TYPE = 'image/png';

type StoredRecord = {
  atlasJson?: object | object[];
  blob: Blob;
  cacheKey: string;
  contentType: string;
  kind: 'atlas' | 'image';
  storedAt: number;
  version: string;
};

type RequestStub = {
  onblocked?: (() => void) | null;
  onerror?: (() => void) | null;
  onsuccess?: (() => void) | null;
  onupgradeneeded?: (() => void) | null;
  result?: unknown;
};

type TransactionStub = {
  onabort?: (() => void) | null;
  oncomplete?: (() => void) | null;
  onerror?: (() => void) | null;
  objectStore: () => StoreStub;
};

type StoreStub = {
  clear: () => RequestStub;
  delete: (key: string) => RequestStub;
  get: (key: string) => RequestStub;
  getAllKeys: () => RequestStub;
  put: (record: StoredRecord) => RequestStub;
};

type TextureManagerMock = Phaser.Textures.TextureManager & {
  addAtlasJSONHash: ReturnType<typeof vi.fn>;
  addCanvas: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
};

describe('generated asset cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('generates canvas textures when IndexedDB is unavailable', async () => {
    const draw = vi.fn();
    const scene = createScene();
    installCanvasStub();
    vi.stubGlobal('indexedDB', undefined);

    const { ensureGeneratedCanvasTexture } = await import('./generatedAssetCache');
    await ensureGeneratedCanvasTexture(scene, {
      draw,
      height: 16,
      key: 'cold-image',
      version: 'v1',
      width: 16,
    });

    expect(draw).toHaveBeenCalledTimes(1);
    expect(scene.textures.addCanvas).toHaveBeenCalledWith('cold-image', expect.anything());
    expect(scene.textures.addImage).not.toHaveBeenCalled();
  });

  it('ignores corrupted image records and regenerates them', async () => {
    const draw = vi.fn();
    const scene = createScene();
    installCanvasStub();
    installIndexedDb(
      new Map([
        [
          'broken-image@v1',
          {
            blob: new Blob(['broken'], { type: PNG_CONTENT_TYPE }),
            cacheKey: 'broken-image@v1',
            contentType: 'text/plain',
            kind: 'image',
            storedAt: 1,
            version: 'v1',
          },
        ],
      ]),
    );

    const { ensureGeneratedCanvasTexture } = await import('./generatedAssetCache');
    await ensureGeneratedCanvasTexture(scene, {
      draw,
      height: 16,
      key: 'broken-image',
      version: 'v1',
      width: 16,
    });

    expect(draw).toHaveBeenCalledTimes(1);
    expect(scene.textures.addCanvas).toHaveBeenCalledWith('broken-image', expect.anything());
    expect(scene.textures.addImage).not.toHaveBeenCalled();
  });

  it('loads warm image records without regenerating the canvas recipe', async () => {
    const draw = vi.fn();
    const scene = createScene();
    installImageStub();
    installIndexedDb(
      new Map([
        [
          'warm-image@v1',
          {
            blob: new Blob(['warm'], { type: PNG_CONTENT_TYPE }),
            cacheKey: 'warm-image@v1',
            contentType: PNG_CONTENT_TYPE,
            kind: 'image',
            storedAt: 1,
            version: 'v1',
          },
        ],
      ]),
    );

    const { ensureGeneratedCanvasTexture } = await import('./generatedAssetCache');
    await ensureGeneratedCanvasTexture(scene, {
      draw,
      height: 16,
      key: 'warm-image',
      version: 'v1',
      width: 16,
    });

    expect(draw).not.toHaveBeenCalled();
    expect(scene.textures.addImage).toHaveBeenCalledWith('warm-image', expect.anything());
    expect(scene.textures.addCanvas).not.toHaveBeenCalled();
  });

  it('generates cold atlas records and stores them after adding the Phaser texture', async () => {
    const scene = createScene();
    const records = new Map<string, StoredRecord>();
    const atlasJson = { frames: { idle: { frame: { h: 8, w: 8, x: 0, y: 0 } } } };
    installCanvasStub(new Blob(['atlas'], { type: PNG_CONTENT_TYPE }));
    installIndexedDb(records);

    const { ensureGeneratedAtlasTexture } = await import('./generatedAssetCache');
    const renderAtlas = vi.fn(() => ({
      atlasJson,
      canvas: document.createElement('canvas') as HTMLCanvasElement,
    }));

    await ensureGeneratedAtlasTexture(scene, {
      key: 'atlas',
      renderAtlas,
      version: 'v1',
    });

    expect(renderAtlas).toHaveBeenCalledTimes(1);
    expect(scene.textures.addAtlasJSONHash).toHaveBeenCalledWith(
      'atlas',
      expect.anything(),
      atlasJson,
    );
    expect(records.get('atlas@v1')).toEqual(
      expect.objectContaining({
        atlasJson,
        cacheKey: 'atlas@v1',
        contentType: PNG_CONTENT_TYPE,
        kind: 'atlas',
        version: 'v1',
      }),
    );
  });

  it('loads warm atlas records into Phaser without regenerating atlas pages', async () => {
    const scene = createScene();
    const atlasJson = { frames: { idle: { frame: { h: 8, w: 8, x: 0, y: 0 } } } };
    const blob = new Blob(['atlas'], { type: PNG_CONTENT_TYPE });
    installImageStub();
    installIndexedDb(
      new Map([
        [
          'warm-atlas@v1',
          {
            atlasJson,
            blob,
            cacheKey: 'warm-atlas@v1',
            contentType: PNG_CONTENT_TYPE,
            kind: 'atlas',
            storedAt: 1,
            version: 'v1',
          },
        ],
      ]),
    );

    const { ensureGeneratedAtlasTexture } = await import('./generatedAssetCache');
    const renderAtlas = vi.fn(() => ({
      atlasJson,
      canvas: document.createElement('canvas') as HTMLCanvasElement,
    }));

    await ensureGeneratedAtlasTexture(scene, {
      key: 'warm-atlas',
      renderAtlas,
      version: 'v1',
    });

    expect(renderAtlas).not.toHaveBeenCalled();
    expect(scene.textures.addAtlasJSONHash).toHaveBeenCalledWith(
      'warm-atlas',
      expect.anything(),
      atlasJson,
    );
    expect(scene.textures.addCanvas).not.toHaveBeenCalled();
  });

  it('prunes cached records that are not declared valid', async () => {
    const records = new Map<string, StoredRecord>([
      ['keep@v2', createStoredRecord('keep', 'v2')],
      ['stale@v1', createStoredRecord('stale', 'v1')],
      ['old@v1', createStoredRecord('old', 'v1')],
    ]);
    installIndexedDb(records);

    const { createGeneratedAssetCacheKey, pruneGeneratedAssetCache } =
      await import('./generatedAssetCache');

    expect(createGeneratedAssetCacheKey({ textureKey: 'keep', version: 'v2' })).toBe('keep@v2');
    await pruneGeneratedAssetCache([{ textureKey: 'keep', version: 'v2' }]);

    expect([...records.keys()].sort()).toEqual(['keep@v2']);
  });

  it('clears all generated cache records for visual generator iteration', async () => {
    const records = new Map<string, StoredRecord>([
      ['first@v1', createStoredRecord('first', 'v1')],
      ['second@v1', createStoredRecord('second', 'v1')],
    ]);
    installIndexedDb(records);

    const { clearGeneratedAssetCache } = await import('./generatedAssetCache');
    await clearGeneratedAssetCache();

    expect(records.size).toBe(0);
  });

  it('reports generated cache stats and marks undeclared records stale', async () => {
    const records = new Map<string, StoredRecord>([
      ['keep@v2', createStoredRecord('keep', 'v2', 'image', 4)],
      ['atlas@v3', createStoredRecord('atlas', 'v3', 'atlas', 7)],
      ['stale@v1', createStoredRecord('stale', 'v1', 'image', 5)],
    ]);
    installIndexedDb(records);

    const { getGeneratedAssetCacheStats } = await import('./generatedAssetCache');
    const stats = await getGeneratedAssetCacheStats([
      { textureKey: 'keep', version: 'v2' },
      { textureKey: 'atlas', version: 'v3' },
    ]);

    expect(stats.totalEntries).toBe(3);
    expect(stats.validEntries).toBe(2);
    expect(stats.staleEntries).toBe(1);
    expect(stats.totalBytes).toBe(16);
    expect(stats.validBytes).toBe(11);
    expect(stats.staleBytes).toBe(5);
    expect(stats.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cacheKey: 'atlas@v3',
          kind: 'atlas',
          textureKey: 'atlas',
          valid: true,
          version: 'v3',
        }),
        expect.objectContaining({
          cacheKey: 'stale@v1',
          textureKey: 'stale',
          valid: false,
        }),
      ]),
    );
  });
});

function createScene(): Phaser.Scene {
  const keys = new Set<string>();
  const textures = {
    addAtlasJSONHash: vi.fn((key: string) => {
      keys.add(key);
      return {};
    }),
    addCanvas: vi.fn((key: string) => {
      keys.add(key);
      return {};
    }),
    addImage: vi.fn((key: string) => {
      keys.add(key);
      return {};
    }),
    exists: (key: string) => keys.has(key),
  };
  return { textures: textures as TextureManagerMock } as unknown as Phaser.Scene;
}

function installCanvasStub(blob = new Blob(['generated'], { type: PNG_CONTENT_TYPE })): void {
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      getContext: vi.fn(() => ({
        clearRect: vi.fn(),
        restore: vi.fn(),
        save: vi.fn(),
      })),
      height: 0,
      toBlob: vi.fn((callback: (nextBlob: Blob | null) => void) => callback(blob)),
      width: 0,
    })),
  });
}

function installImageStub(): void {
  class StubImage {
    decoding = '';
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  vi.stubGlobal('Image', StubImage);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:generated-asset'),
    revokeObjectURL: vi.fn(),
  });
}

function installIndexedDb(records: Map<string, StoredRecord>): void {
  vi.stubGlobal('indexedDB', {
    open: vi.fn(() => {
      const request: RequestStub = {};
      const database = createDatabase(records);
      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }),
  });
}

function createDatabase(records: Map<string, StoredRecord>): IDBDatabase {
  let hasStore = false;
  const database = {
    createObjectStore: vi.fn(() => {
      hasStore = true;
      return createStore(records);
    }),
    objectStoreNames: {
      contains: () => hasStore,
    },
    transaction: vi.fn((): TransactionStub => {
      const transaction: TransactionStub = {
        objectStore: () => createStore(records, transaction),
      };
      return transaction;
    }),
  };
  return database as unknown as IDBDatabase;
}

function createStore(records: Map<string, StoredRecord>, transaction?: TransactionStub): StoreStub {
  return {
    clear: () => {
      const request: RequestStub = {};
      queueMicrotask(() => {
        records.clear();
        request.onsuccess?.();
        transaction?.oncomplete?.();
      });
      return request;
    },
    delete: (key: string) => {
      const request: RequestStub = {};
      queueMicrotask(() => {
        records.delete(key);
        request.onsuccess?.();
        transaction?.oncomplete?.();
      });
      return request;
    },
    get: (key: string) => {
      const request: RequestStub = {};
      queueMicrotask(() => {
        request.result = records.get(key);
        request.onsuccess?.();
      });
      return request;
    },
    getAllKeys: () => {
      const request: RequestStub = {};
      queueMicrotask(() => {
        request.result = [...records.keys()];
        request.onsuccess?.();
      });
      return request;
    },
    put: (record: StoredRecord) => {
      const request: RequestStub = {};
      queueMicrotask(() => {
        records.set(record.cacheKey, record);
        request.onsuccess?.();
        transaction?.oncomplete?.();
      });
      return request;
    },
  };
}

function createStoredRecord(
  textureKey: string,
  version: string,
  kind: StoredRecord['kind'] = 'image',
  bytes?: number,
): StoredRecord {
  const content = bytes ? 'x'.repeat(bytes) : textureKey;
  return {
    blob: new Blob([content], { type: PNG_CONTENT_TYPE }),
    cacheKey: `${textureKey}@${version}`,
    contentType: PNG_CONTENT_TYPE,
    kind,
    storedAt: 1,
    version,
  };
}
