import type Phaser from 'phaser';

const DATABASE_NAME = 'comet-bursters-generated-assets';
const DATABASE_VERSION = 1;
const STORE_NAME = 'assets';
const PNG_CONTENT_TYPE = 'image/png';

type GeneratedAssetRecord = {
  atlasJson?: object | object[];
  blob: Blob;
  cacheKey: string;
  contentType: string;
  kind: 'atlas' | 'image';
  storedAt: number;
  version: string;
};

export type GeneratedAssetCacheEntry = {
  textureKey: string;
  version: string;
};

export type GeneratedAssetCacheStatsEntry = {
  bytes: number;
  cacheKey: string;
  kind: 'atlas' | 'image';
  storedAt: number;
  textureKey: string;
  valid: boolean;
  version: string;
};

export type GeneratedAssetCacheStats = {
  entries: GeneratedAssetCacheStatsEntry[];
  staleBytes: number;
  staleEntries: number;
  totalBytes: number;
  totalEntries: number;
  validBytes: number;
  validEntries: number;
};

export type GeneratedCanvasTextureRecipe = {
  draw: (ctx: CanvasRenderingContext2D) => void;
  height: number;
  key: string;
  version: string;
  width: number;
};

export type GeneratedAtlasTexture = {
  atlasJson: object | object[];
  blob: Blob;
};

let databasePromise: Promise<IDBDatabase | null> | null = null;

export function createGeneratedAssetCacheKey(entry: GeneratedAssetCacheEntry): string {
  return createCacheKey(entry.textureKey, entry.version);
}

export async function ensureGeneratedCanvasTexture(
  scene: Phaser.Scene,
  recipe: GeneratedCanvasTextureRecipe,
): Promise<void> {
  if (scene.textures.exists(recipe.key)) return;

  const cachedBlob = await readGeneratedImageTexture(recipe.key, recipe.version);
  if (cachedBlob && !scene.textures.exists(recipe.key)) {
    const loaded = await addGeneratedImageTexture(scene, recipe.key, cachedBlob);
    if (loaded) return;
  }

  if (scene.textures.exists(recipe.key)) return;

  const canvas = renderCanvasRecipe(recipe);
  scene.textures.addCanvas(recipe.key, canvas);
  const blob = await canvasToPngBlob(canvas);
  if (blob) await writeGeneratedImageTexture(recipe.key, recipe.version, blob);
}

export async function readGeneratedImageTexture(
  textureKey: string,
  version: string,
): Promise<Blob | null> {
  const record = await readGeneratedAssetRecord(textureKey, version);
  return record?.kind === 'image' ? record.blob : null;
}

export async function writeGeneratedImageTexture(
  textureKey: string,
  version: string,
  blob: Blob,
): Promise<void> {
  await writeGeneratedAssetRecord(textureKey, version, { blob, kind: 'image' });
}

export async function addGeneratedImageTexture(
  scene: Phaser.Scene,
  textureKey: string,
  blob: Blob,
): Promise<boolean> {
  return addBlobTexture(scene, textureKey, blob);
}

export async function readGeneratedAtlasTexture(
  textureKey: string,
  version: string,
): Promise<GeneratedAtlasTexture | null> {
  const record = await readGeneratedAssetRecord(textureKey, version);
  if (!record || record.kind !== 'atlas' || !record.atlasJson) return null;
  return { atlasJson: record.atlasJson, blob: record.blob };
}

export async function writeGeneratedAtlasTexture(
  textureKey: string,
  version: string,
  atlas: GeneratedAtlasTexture,
): Promise<void> {
  await writeGeneratedAssetRecord(textureKey, version, {
    atlasJson: atlas.atlasJson,
    blob: atlas.blob,
    kind: 'atlas',
  });
}

export async function addGeneratedAtlasTexture(
  scene: Phaser.Scene,
  textureKey: string,
  atlas: GeneratedAtlasTexture,
): Promise<boolean> {
  const image = await loadBlobImage(atlas.blob).catch(() => null);
  if (!image) return false;
  if (scene.textures.exists(textureKey)) return true;

  const texture = scene.textures.addAtlasJSONHash(textureKey, image, atlas.atlasJson);
  return !!texture;
}

export async function pruneGeneratedAssetCache(
  validEntries: readonly GeneratedAssetCacheEntry[],
): Promise<void> {
  const database = await getGeneratedAssetDatabase();
  if (!database) return;

  const validKeys = new Set(validEntries.map((entry) => createGeneratedAssetCacheKey(entry)));
  const cachedKeys = await readGeneratedAssetCacheKeys(database);
  if (cachedKeys.length === 0) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      for (const key of cachedKeys) {
        if (!validKeys.has(key)) store.delete(key);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getGeneratedAssetCacheStats(
  validEntries: readonly GeneratedAssetCacheEntry[] = [],
): Promise<GeneratedAssetCacheStats> {
  const database = await getGeneratedAssetDatabase();
  if (!database) return createEmptyGeneratedAssetCacheStats();

  const validKeys = new Set(validEntries.map((entry) => createGeneratedAssetCacheKey(entry)));
  const hasValidEntrySet = validEntries.length > 0;
  const cacheKeys = await readGeneratedAssetCacheKeys(database);
  const records = await readGeneratedAssetRecords(database, cacheKeys);
  const entries = records.map((record) => {
    const valid = !hasValidEntrySet || validKeys.has(record.cacheKey);
    return {
      bytes: record.blob.size,
      cacheKey: record.cacheKey,
      kind: record.kind,
      storedAt: record.storedAt,
      textureKey: getTextureKeyFromCacheRecord(record),
      valid,
      version: record.version,
    };
  });
  const validStats = entries.filter((entry) => entry.valid);
  const staleStats = entries.filter((entry) => !entry.valid);
  return {
    entries,
    staleBytes: sumBytes(staleStats),
    staleEntries: staleStats.length,
    totalBytes: sumBytes(entries),
    totalEntries: entries.length,
    validBytes: sumBytes(validStats),
    validEntries: validStats.length,
  };
}

export async function clearGeneratedAssetCache(): Promise<void> {
  const database = await getGeneratedAssetDatabase();
  if (!database) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function createGeneratedCanvasTexture(
  scene: Phaser.Scene,
  recipe: GeneratedCanvasTextureRecipe,
): void {
  if (scene.textures.exists(recipe.key)) return;

  const canvas = renderCanvasRecipe(recipe);
  scene.textures.addCanvas(recipe.key, canvas);
  void canvasToPngBlob(canvas).then((blob) => {
    if (blob) void writeGeneratedImageTexture(recipe.key, recipe.version, blob);
  });
}

function renderCanvasRecipe(recipe: GeneratedCanvasTextureRecipe): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = recipe.width;
  canvas.height = recipe.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`Unable to create canvas for generated texture ${recipe.key}`);
  context.save();
  try {
    context.clearRect(0, 0, recipe.width, recipe.height);
    recipe.draw(context);
  } finally {
    context.restore();
  }
  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), PNG_CONTENT_TYPE);
  });
}

async function addBlobTexture(
  scene: Phaser.Scene,
  textureKey: string,
  blob: Blob,
): Promise<boolean> {
  const image = await loadBlobImage(blob).catch(() => null);
  if (!image) return false;
  if (scene.textures.exists(textureKey)) return true;

  const texture = scene.textures.addImage(textureKey, image);
  return !!texture;
}

function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to decode generated texture image'));
    };
    image.src = url;
  });
}

async function readGeneratedAssetCacheKeys(database: IDBDatabase): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onerror = () => resolve([]);
      request.onsuccess = () => {
        const keys = request.result
          .map((key) => (typeof key === 'string' ? key : null))
          .filter((key): key is string => key !== null);
        resolve(keys);
      };
    } catch {
      resolve([]);
    }
  });
}

async function readGeneratedAssetRecords(
  database: IDBDatabase,
  cacheKeys: readonly string[],
): Promise<GeneratedAssetRecord[]> {
  const records = await Promise.all(
    cacheKeys.map((cacheKey) => readGeneratedAssetRecordByKey(database, cacheKey)),
  );
  return records.filter((record): record is GeneratedAssetRecord => record !== null);
}

async function readGeneratedAssetRecordByKey(
  database: IDBDatabase,
  cacheKey: string,
): Promise<GeneratedAssetRecord | null> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const record = request.result as GeneratedAssetRecord | undefined;
        const isValid =
          record?.cacheKey === cacheKey &&
          record.blob instanceof Blob &&
          record.contentType === PNG_CONTENT_TYPE;
        resolve(isValid ? record : null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function readGeneratedAssetRecord(
  textureKey: string,
  version: string,
): Promise<GeneratedAssetRecord | null> {
  const database = await getGeneratedAssetDatabase();
  if (!database) return null;

  const cacheKey = createCacheKey(textureKey, version);
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const record = request.result as GeneratedAssetRecord | undefined;
        const isValid =
          record?.cacheKey === cacheKey &&
          record.version === version &&
          record.blob instanceof Blob &&
          record.contentType === PNG_CONTENT_TYPE;
        resolve(isValid ? record : null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function writeGeneratedAssetRecord(
  textureKey: string,
  version: string,
  asset: {
    atlasJson?: object | object[];
    blob: Blob;
    kind: GeneratedAssetRecord['kind'];
  },
): Promise<void> {
  const database = await getGeneratedAssetDatabase();
  if (!database) return;

  const cacheKey = createCacheKey(textureKey, version);
  const record: GeneratedAssetRecord = {
    atlasJson: asset.atlasJson,
    blob: asset.blob,
    cacheKey,
    contentType: PNG_CONTENT_TYPE,
    kind: asset.kind,
    storedAt: Date.now(),
    version,
  };

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);
      request.onerror = () => resolve();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function createCacheKey(textureKey: string, version: string): string {
  return `${textureKey}@${version}`;
}

function createEmptyGeneratedAssetCacheStats(): GeneratedAssetCacheStats {
  return {
    entries: [],
    staleBytes: 0,
    staleEntries: 0,
    totalBytes: 0,
    totalEntries: 0,
    validBytes: 0,
    validEntries: 0,
  };
}

function getTextureKeyFromCacheRecord(record: GeneratedAssetRecord): string {
  const suffix = `@${record.version}`;
  return record.cacheKey.endsWith(suffix)
    ? record.cacheKey.slice(0, -suffix.length)
    : record.cacheKey;
}

function sumBytes(entries: readonly GeneratedAssetCacheStatsEntry[]): number {
  return entries.reduce((total, entry) => total + entry.bytes, 0);
}

function getGeneratedAssetDatabase(): Promise<IDBDatabase | null> {
  if (!databasePromise) databasePromise = openGeneratedAssetDatabase();
  return databasePromise;
}

function openGeneratedAssetDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onblocked = () => resolve(null);
    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}
