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
  get: (key: string) => RequestStub;
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

  it('returns null for cold atlas misses and reads stored atlas records after writing', async () => {
    const records = new Map<string, StoredRecord>();
    const atlasJson = { frames: { idle: { frame: { h: 8, w: 8, x: 0, y: 0 } } } };
    const blob = new Blob(['atlas'], { type: PNG_CONTENT_TYPE });
    installIndexedDb(records);

    const { readGeneratedAtlasTexture, writeGeneratedAtlasTexture } =
      await import('./generatedAssetCache');

    await expect(readGeneratedAtlasTexture('atlas', 'v1')).resolves.toBeNull();
    await writeGeneratedAtlasTexture('atlas', 'v1', { atlasJson, blob });
    await expect(readGeneratedAtlasTexture('atlas', 'v1')).resolves.toEqual({ atlasJson, blob });
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

    const { addGeneratedAtlasTexture, readGeneratedAtlasTexture } =
      await import('./generatedAssetCache');

    const atlas = await readGeneratedAtlasTexture('warm-atlas', 'v1');
    expect(atlas).toEqual({ atlasJson, blob });
    expect(atlas).not.toBeNull();
    if (atlas) await addGeneratedAtlasTexture(scene, 'warm-atlas', atlas);

    expect(scene.textures.addAtlasJSONHash).toHaveBeenCalledWith(
      'warm-atlas',
      expect.anything(),
      atlasJson,
    );
    expect(scene.textures.addCanvas).not.toHaveBeenCalled();
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
    get: (key: string) => {
      const request: RequestStub = {};
      queueMicrotask(() => {
        request.result = records.get(key);
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
