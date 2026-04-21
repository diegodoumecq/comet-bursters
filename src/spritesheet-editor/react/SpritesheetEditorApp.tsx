import { useEffect, useMemo, useState } from 'react';

import type { ShipInteriorTilesetDefinition } from '../../scenes/ShipInteriorScene/level';
import { shipInteriorTileAssets } from '../../scenes/ShipInteriorScene/tileAssets';
import { bundledTilesets } from '../../scenes/ShipInteriorScene/tilesetCatalog';

type TileEntry = {
  id: string;
  column: number;
  row: number;
};

function cloneTileset(tileset: ShipInteriorTilesetDefinition): ShipInteriorTilesetDefinition {
  return {
    ...tileset,
    grid: { ...tileset.grid },
    tiles: { ...tileset.tiles },
  };
}

function makeTileEntries(tileset: ShipInteriorTilesetDefinition): TileEntry[] {
  return Object.entries(tileset.tiles)
    .map(([id, [column, row]]) => ({ column, id, row }))
    .sort((left, right) => left.row - right.row || left.column - right.column || left.id.localeCompare(right.id));
}

function makeTilesetFromEntries(
  tileset: ShipInteriorTilesetDefinition,
  entries: TileEntry[],
): ShipInteriorTilesetDefinition {
  return {
    ...tileset,
    tiles: Object.fromEntries(
      entries
        .filter((entry) => entry.id.trim())
        .map((entry) => [entry.id.trim(), [entry.column, entry.row]]),
    ),
  };
}

function makeTilesetFileName(tileset: ShipInteriorTilesetDefinition): string {
  return `${tileset.id}.tileset.json`;
}

function makeNewTilesetId(): string {
  const existingIds = new Set(bundledTilesets.map((entry) => entry.tileset.id));
  let nextIndex = bundledTilesets.length + 1;
  let nextId = `new-tileset-${nextIndex}`;

  while (existingIds.has(nextId)) {
    nextIndex += 1;
    nextId = `new-tileset-${nextIndex}`;
  }

  return nextId;
}

function readNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SpritesheetEditorApp() {
  const initialEntry = bundledTilesets[0] ?? null;
  const [selectedFileName, setSelectedFileName] = useState(initialEntry?.fileName ?? '');
  const [tileset, setTileset] = useState<ShipInteriorTilesetDefinition | null>(
    initialEntry ? cloneTileset(initialEntry.tileset) : null,
  );
  const [tileEntries, setTileEntries] = useState<TileEntry[]>(
    initialEntry ? makeTileEntries(initialEntry.tileset) : [],
  );
  const [selectedTileId, setSelectedTileId] = useState<string | null>(tileEntries[0]?.id ?? null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [previewZoom, setPreviewZoom] = useState(2);

  const selectedAsset = useMemo(
    () =>
      tileset
        ? shipInteriorTileAssets.find((asset) => asset.imageSrc === tileset.imageSrc) ?? null
        : null,
    [tileset],
  );

  useEffect(() => {
    if (!selectedAsset) {
      setImage(null);
      return;
    }

    let cancelled = false;
    const nextImage = new Image();
    nextImage.onload = () => {
      if (!cancelled) {
        setImage(nextImage);
      }
    };
    nextImage.onerror = () => {
      if (!cancelled) {
        setImage(null);
      }
    };
    nextImage.src = selectedAsset.url;

    return () => {
      cancelled = true;
    };
  }, [selectedAsset]);

  const selectTileset = (fileName: string) => {
    const entry = bundledTilesets.find((candidate) => candidate.fileName === fileName);
    if (!entry) {
      return;
    }

    const nextTileset = cloneTileset(entry.tileset);
    const nextEntries = makeTileEntries(nextTileset);
    setSelectedFileName(fileName);
    setTileset(nextTileset);
    setTileEntries(nextEntries);
    setSelectedTileId(nextEntries[0]?.id ?? null);
  };

  const createNewTileset = () => {
    const firstAsset = shipInteriorTileAssets[0];
    if (!firstAsset) {
      alert('Cannot create a tileset without a PNG asset in src/assets/tiles.');
      return;
    }

    const nextId = makeNewTilesetId();
    setSelectedFileName('');
    setTileset({
      id: nextId,
      imageSrc: firstAsset.imageSrc,
      grid: {
        frameWidth: 32,
        frameHeight: 32,
        offsetX: 0,
        offsetY: 0,
        gapX: 0,
        gapY: 0,
        columns: 1,
        rows: 1,
      },
      tiles: {},
    });
    setTileEntries([]);
    setSelectedTileId(null);
  };

  const updateGrid = (
    key: keyof ShipInteriorTilesetDefinition['grid'],
    value: number,
  ) => {
    setTileset((current) =>
      current
        ? {
            ...current,
            grid: {
              ...current.grid,
              [key]: value,
            },
          }
        : current,
    );
  };

  const updateTileEntry = (index: number, updates: Partial<TileEntry>) => {
    setTileEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              ...updates,
            }
          : entry,
      ),
    );
  };

  const saveTileset = async () => {
    if (!tileset) {
      return;
    }

    const tilesetToSave = makeTilesetFromEntries(tileset, tileEntries);
    const fileName = makeTilesetFileName(tilesetToSave);

    try {
      const response = await fetch('/__editor/save-tileset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          tileset: tilesetToSave,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error ?? 'Failed to save tileset');
      }

      setSelectedFileName(fileName);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save tileset');
    }
  };

  const updatePreviewZoom = (nextZoom: number) => {
    setPreviewZoom(Math.min(6, Math.max(0.5, nextZoom)));
  };

  const selectedTile = tileEntries.find((entry) => entry.id === selectedTileId) ?? null;
  const grid = tileset?.grid;
  const frameWidth = grid?.frameWidth ?? 32;
  const frameHeight = grid?.frameHeight ?? 32;
  const offsetX = grid?.offsetX ?? 0;
  const offsetY = grid?.offsetY ?? 0;
  const gapX = grid?.gapX ?? 0;
  const gapY = grid?.gapY ?? 0;
  const columns = grid?.columns ?? 0;
  const rows = grid?.rows ?? 0;
  const previewScale = previewZoom;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <aside className="flex h-full w-96 shrink-0 flex-col border-r border-slate-800 bg-slate-950/95">
        <div className="border-b border-slate-800 px-6 py-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <a
              href="/"
              className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Back Home
            </a>
            <button
              type="button"
              onClick={() => void saveTileset()}
              className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-500/20"
            >
              Save
            </button>
            <button
              type="button"
              onClick={createNewTileset}
              className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 hover:border-slate-500 hover:text-white"
            >
              New
            </button>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Spritesheet Editor
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-white">Tileset Definition</h1>
        </div>

        {tileset ? (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Tileset JSON
              <select
                value={selectedFileName}
                onChange={(event) => selectTileset(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
              >
                {selectedFileName ? null : <option value="">Unsaved new tileset</option>}
                {bundledTilesets.map((entry) => (
                  <option key={entry.fileName} value={entry.fileName}>
                    {entry.fileName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Id
              <input
                value={tileset.id}
                onChange={(event) =>
                  setTileset((current) => (current ? { ...current, id: event.target.value } : current))
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              PNG Asset
              <select
                value={tileset.imageSrc}
                onChange={(event) =>
                  setTileset((current) =>
                    current ? { ...current, imageSrc: event.target.value } : current,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
              >
                {shipInteriorTileAssets.map((asset) => (
                  <option key={asset.imageSrc} value={asset.imageSrc}>
                    {asset.fileName}
                  </option>
                ))}
              </select>
            </label>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Grid
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['frameWidth', frameWidth],
                    ['frameHeight', frameHeight],
                    ['offsetX', offsetX],
                    ['offsetY', offsetY],
                    ['gapX', gapX],
                    ['gapY', gapY],
                    ['columns', columns],
                    ['rows', rows],
                  ] as const
                ).map(([key, value]) => (
                  <label key={key} className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {key}
                    <input
                      type="number"
                      min="0"
                      value={value}
                      onChange={(event) => updateGrid(key, readNumber(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label
                  htmlFor="spritesheet-preview-zoom"
                  className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Preview Zoom
                </label>
                <span className="text-sm tabular-nums text-slate-300">
                  {Math.round(previewZoom * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updatePreviewZoom(previewZoom - 0.5)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 text-slate-200 transition hover:border-slate-500 hover:text-white"
                  aria-label="Zoom out"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M5 10h10" />
                  </svg>
                </button>
                <input
                  id="spritesheet-preview-zoom"
                  type="range"
                  min="50"
                  max="600"
                  step="50"
                  value={Math.round(previewZoom * 100)}
                  onChange={(event) => updatePreviewZoom(Number(event.target.value) / 100)}
                  className="min-w-0 flex-1"
                  aria-label="Preview zoom"
                />
                <button
                  type="button"
                  onClick={() => updatePreviewZoom(previewZoom + 0.5)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 text-slate-200 transition hover:border-slate-500 hover:text-white"
                  aria-label="Zoom in"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M10 5v10" />
                    <path d="M5 10h10" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => updatePreviewZoom(2)}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  Reset
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Tiles
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextId = `tile_${tileEntries.length + 1}`;
                    setTileEntries((current) => [...current, { column: 0, id: nextId, row: 0 }]);
                    setSelectedTileId(nextId);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {tileEntries.map((entry, index) => (
                  <div
                    key={`${entry.id}-${index}`}
                    className={`grid grid-cols-[1fr_4rem_4rem_auto] items-center gap-2 rounded-xl border p-2 ${
                      selectedTileId === entry.id
                        ? 'border-cyan-300 bg-cyan-500/15'
                        : 'border-slate-800 bg-slate-950/50'
                    }`}
                  >
                    <input
                      value={entry.id}
                      onFocus={() => setSelectedTileId(entry.id)}
                      onChange={(event) => updateTileEntry(index, { id: event.target.value })}
                      className="min-w-0 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400"
                    />
                    <input
                      type="number"
                      min="0"
                      value={entry.column}
                      onFocus={() => setSelectedTileId(entry.id)}
                      onChange={(event) => updateTileEntry(index, { column: readNumber(event.target.value) })}
                      className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400"
                      aria-label={`${entry.id} column`}
                    />
                    <input
                      type="number"
                      min="0"
                      value={entry.row}
                      onFocus={() => setSelectedTileId(entry.id)}
                      onChange={(event) => updateTileEntry(index, { row: readNumber(event.target.value) })}
                      className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400"
                      aria-label={`${entry.id} row`}
                    />
                    <button
                      type="button"
                      onClick={() => setTileEntries((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                      className="rounded-lg px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/15"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-400">No tileset JSON files found.</div>
        )}
      </aside>

      <main className="min-w-0 flex-1 overflow-auto bg-slate-950 p-8">
        <div className="inline-block rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50">
          <div className="mb-4 flex items-center justify-between gap-6">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Preview
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {selectedAsset?.fileName ?? 'No PNG selected'}
              </div>
            </div>
            {image ? (
              <div className="text-xs text-slate-500">
                {image.width} x {image.height}
              </div>
            ) : null}
          </div>

          {image ? (
            <div
              className="relative overflow-hidden border border-slate-800 bg-slate-950"
              style={{
                height: image.height * previewScale,
                width: image.width * previewScale,
              }}
            >
              <img
                src={image.src}
                alt={tileset?.id ?? 'spritesheet'}
                draggable={false}
                className="absolute inset-0 max-w-none"
                style={{
                  height: image.height * previewScale,
                  imageRendering: 'pixelated',
                  width: image.width * previewScale,
                }}
              />
              {Array.from({ length: Math.max(0, rows) }).flatMap((_, row) =>
                Array.from({ length: Math.max(0, columns) }).map((__, column) => {
                  const left = (offsetX + column * (frameWidth + gapX)) * previewScale;
                  const top = (offsetY + row * (frameHeight + gapY)) * previewScale;
                  const tile = tileEntries.find((entry) => entry.column === column && entry.row === row);
                  const isSelected = selectedTile?.column === column && selectedTile.row === row;
                  return (
                    <button
                      key={`${column}-${row}`}
                      type="button"
                      onClick={() => {
                        if (tile) {
                          setSelectedTileId(tile.id);
                        }
                      }}
                      className={`absolute border bg-transparent ${
                        isSelected
                          ? 'border-yellow-300 shadow-[0_0_0_2px_rgba(250,204,21,0.35)]'
                          : tile
                            ? 'border-cyan-300/70'
                            : 'border-slate-400/20'
                      }`}
                      style={{
                        height: frameHeight * previewScale,
                        left,
                        top,
                        width: frameWidth * previewScale,
                      }}
                      title={tile ? `${tile.id} [${column}, ${row}]` : `[${column}, ${row}]`}
                    />
                  );
                }),
              )}
            </div>
          ) : (
            <div className="flex h-96 w-[40rem] items-center justify-center border border-slate-800 bg-slate-950 text-sm text-slate-500">
              No spritesheet image loaded.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
