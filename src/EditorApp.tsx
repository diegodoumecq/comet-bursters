import { useEffect, useMemo, useRef, useState } from 'react';

import defaultLevel from './scenes/ShipInteriorScene/shipInterior.level.json';
import type {
  RawShipInteriorLevel,
  ShipInteriorTilesetDefinition,
} from './scenes/ShipInteriorScene/level';

type ImageMap = Record<string, HTMLImageElement | null>;
type AssetUrlMap = Record<string, string>;

function cloneLevel(level: RawShipInteriorLevel): RawShipInteriorLevel {
  return JSON.parse(JSON.stringify(level)) as RawShipInteriorLevel;
}

function serializeShipInteriorLevel(level: RawShipInteriorLevel): string {
  return JSON.stringify(level, null, 2);
}

function placeTile(
  level: RawShipInteriorLevel,
  layerId: string,
  tileId: string,
  x: number,
  y: number,
): RawShipInteriorLevel {
  return {
    ...level,
    layers: level.layers.map((layer) =>
      layer.id !== layerId
        ? layer
        : {
            ...layer,
            tiles: [
              ...layer.tiles.filter((tile) => tile.x !== x || tile.y !== y),
              { tile: tileId, x, y },
            ],
          },
    ),
  };
}

function eraseTile(level: RawShipInteriorLevel, layerId: string, x: number, y: number): RawShipInteriorLevel {
  return {
    ...level,
    layers: level.layers.map((layer) =>
      layer.id !== layerId
        ? layer
        : {
            ...layer,
            tiles: layer.tiles.filter((tile) => tile.x !== x || tile.y !== y),
          },
    ),
  };
}

function getTilesetForLayer(
  level: RawShipInteriorLevel,
  layerId: string | null,
): ShipInteriorTilesetDefinition | null {
  if (!layerId) {
    return null;
  }

  const layer = level.layers.find((candidate) => candidate.id === layerId);
  if (!layer) {
    return null;
  }

  return level.tilesets.find((candidate) => candidate.id === layer.tilesetId) ?? null;
}

function getEffectiveTilesetImageSrc(
  tileset: ShipInteriorTilesetDefinition,
  assetUrls: AssetUrlMap,
): string {
  return assetUrls[tileset.id] ?? tileset.imageSrc;
}

function TileSwatch({
  image,
  frameWidth,
  frameHeight,
  tile,
  label,
  selected,
  onClick,
}: {
  image: HTMLImageElement | null;
  frameWidth: number;
  frameHeight: number;
  tile: [number, number];
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const scale = 1.5;
  const previewWidth = frameWidth * scale;
  const previewHeight = frameHeight * scale;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-2 rounded-xl border p-2 text-left transition ${
        selected
          ? 'border-cyan-300 bg-cyan-500/15 shadow-[0_0_0_1px_rgba(103,232,249,0.4)]'
          : 'border-slate-700 bg-slate-900/70 hover:border-slate-500 hover:bg-slate-800/70'
      }`}
    >
      <div className="flex h-16 items-center justify-center rounded-lg bg-slate-950/80">
        {image ? (
          <div
            className="overflow-hidden rounded"
            style={{ width: previewWidth, height: previewHeight }}
          >
            <img
              src={image.src}
              alt={label}
              draggable={false}
              style={{
                maxWidth: 'none',
                width: image.width * scale,
                height: image.height * scale,
                transform: `translate(${-tile[0] * previewWidth}px, ${-tile[1] * previewHeight}px)`,
                imageRendering: 'pixelated',
              }}
            />
          </div>
        ) : (
          <span className="text-xs text-slate-500">No preview</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-100">{label}</div>
        <div className="text-[11px] text-slate-400">
          [{tile[0]}, {tile[1]}]
        </div>
      </div>
    </button>
  );
}

export function EditorApp() {
  const [level, setLevel] = useState<RawShipInteriorLevel>(() =>
    cloneLevel(defaultLevel as RawShipInteriorLevel),
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    (defaultLevel as RawShipInteriorLevel).layers[0]?.id ?? null,
  );
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [assetUrls, setAssetUrls] = useState<AssetUrlMap>({});
  const [images, setImages] = useState<ImageMap>({});
  const [status, setStatus] = useState<string>('Ready');
  const [assetPathInput, setAssetPathInput] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedLayer = useMemo(
    () => level.layers.find((candidate) => candidate.id === selectedLayerId) ?? null,
    [level.layers, selectedLayerId],
  );

  const selectedTileset = useMemo(
    () => getTilesetForLayer(level, selectedLayerId),
    [level, selectedLayerId],
  );

  const selectedTiles = useMemo(
    () => (selectedTileset ? Object.entries(selectedTileset.tiles) : []),
    [selectedTileset],
  );

  useEffect(() => {
    if (!selectedLayerId && level.layers.length > 0) {
      setSelectedLayerId(level.layers[0].id);
    }
  }, [level.layers, selectedLayerId]);

  useEffect(() => {
    if (!selectedTileset) {
      setSelectedTileId(null);
      setAssetPathInput('');
      return;
    }

    setAssetPathInput(selectedTileset.imageSrc);
    if (!selectedTileId || !(selectedTileId in selectedTileset.tiles)) {
      const [firstTileId] = Object.keys(selectedTileset.tiles);
      setSelectedTileId(firstTileId ?? null);
    }
  }, [selectedTileId, selectedTileset]);

  useEffect(() => {
    let cancelled = false;

    const loadAllTilesetImages = async () => {
      const entries = await Promise.all(
        level.tilesets.map(async (tileset) => {
          const src = getEffectiveTilesetImageSrc(tileset, assetUrls);

          if (!src) {
            return [tileset.id, null] as const;
          }

          try {
            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
              const nextImage = new Image();
              nextImage.onload = () => resolve(nextImage);
              nextImage.onerror = () => reject(new Error(`Failed to load ${src}`));
              nextImage.src = src;
            });
            return [tileset.id, image] as const;
          } catch {
            return [tileset.id, null] as const;
          }
        }),
      );

      if (!cancelled) {
        setImages(Object.fromEntries(entries));
      }
    };

    void loadAllTilesetImages();

    return () => {
      cancelled = true;
    };
  }, [assetUrls, level.tilesets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = level.width;
    canvas.height = level.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#08111d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= level.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, level.height);
      ctx.stroke();
    }
    for (let y = 0; y <= level.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(level.width, y);
      ctx.stroke();
    }

    for (const layer of level.layers) {
      const tileset = level.tilesets.find((candidate) => candidate.id === layer.tilesetId);
      if (!tileset) {
        continue;
      }

      const image = images[tileset.id];
      if (!image) {
        continue;
      }

      for (const tile of layer.tiles) {
        const frame = tileset.tiles[tile.tile];
        if (!frame) {
          continue;
        }

        ctx.drawImage(
          image,
          frame[0] * tileset.grid.frameWidth,
          frame[1] * tileset.grid.frameHeight,
          tileset.grid.frameWidth,
          tileset.grid.frameHeight,
          tile.x * tileset.grid.frameWidth,
          tile.y * tileset.grid.frameHeight,
          tileset.grid.frameWidth,
          tileset.grid.frameHeight,
        );
      }
    }
  }, [images, level]);

  const handleCanvasPointer = (
    event: React.MouseEvent<HTMLCanvasElement>,
    mode: 'paint' | 'erase',
  ) => {
    if (!selectedLayer || !selectedTileset) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    const x = Math.floor(((event.clientX - rect.left) * scaleX) / selectedTileset.grid.frameWidth);
    const y = Math.floor(((event.clientY - rect.top) * scaleY) / selectedTileset.grid.frameHeight);

    setLevel((currentLevel) =>
      mode === 'paint'
        ? selectedTileId
          ? placeTile(currentLevel, selectedLayer.id, selectedTileId, x, y)
          : currentLevel
        : eraseTile(currentLevel, selectedLayer.id, x, y),
    );
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as RawShipInteriorLevel;
      setLevel(parsed);
      setStatus(`Loaded ${file.name}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to import JSON');
    } finally {
      event.target.value = '';
    }
  };

  const handlePickTilesetPng = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTileset) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setAssetUrls((current) => {
      const previousUrl = current[selectedTileset.id];
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return { ...current, [selectedTileset.id]: objectUrl };
    });
    setStatus(`Loaded preview asset ${file.name}`);
    event.target.value = '';
  };

  const handleApplyAssetPath = () => {
    if (!selectedTileset || !assetPathInput.trim()) {
      return;
    }

    setLevel((currentLevel) => ({
      ...currentLevel,
      tilesets: currentLevel.tilesets.map((tileset) =>
        tileset.id === selectedTileset.id
          ? { ...tileset, imageSrc: assetPathInput.trim() }
          : tileset,
      ),
    }));
    setStatus(`Updated ${selectedTileset.id} asset path`);
  };

  const handleExport = async () => {
    const json = serializeShipInteriorLevel(level);
    await navigator.clipboard.writeText(json);
    setStatus('Copied level JSON to clipboard');
  };

  const activeImage = selectedTileset ? images[selectedTileset.id] : null;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-[23rem] shrink-0 flex-col border-r border-slate-800 bg-slate-950/95">
        <div className="border-b border-slate-800 px-6 py-5">
          <a
            href="/"
            className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Back Home
          </a>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Comet Bursters
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Level Editor</h1>
          <p className="mt-2 text-sm text-slate-400">
            React + Tailwind editor shell with JSON import/export, tileset asset selection, and tile
            painting.
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-3">
            <div className="text-sm font-semibold text-slate-200">Level</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm text-slate-300">{level.name}</div>
              <div className="mt-1 text-xs text-slate-500">
                {level.width} x {level.height}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-center text-sm text-slate-200 hover:border-slate-500">
                  Import JSON
                  <input className="hidden" type="file" accept="application/json" onChange={handleImportJson} />
                </label>
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/20"
                >
                  Copy JSON
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold text-slate-200">Layer</div>
            <div className="grid gap-2">
              {level.layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm ${
                    selectedLayerId === layer.id
                      ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="font-medium">{layer.id}</div>
                  <div className="text-xs text-slate-500">
                    {layer.hasCollision ? 'Collidable' : 'Visual only'} • {layer.tiles.length} tiles
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold text-slate-200">Tileset Asset</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-sm text-slate-300">{selectedTileset?.id ?? 'No tileset'}</div>
              <label className="mt-4 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Export Path
              </label>
              <input
                value={assetPathInput}
                onChange={(event) => setAssetPathInput(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
                placeholder="./tiles/interior-main.png"
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleApplyAssetPath}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Apply Path
                </button>
                <label className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-center text-sm text-slate-200 hover:border-slate-500">
                  Pick PNG
                  <input
                    ref={fileInputRef}
                    className="hidden"
                    type="file"
                    accept="image/png"
                    onChange={handlePickTilesetPng}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-200">Palette</div>
              <div className="text-xs text-slate-500">{selectedTiles.length} tiles</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {selectedTiles.map(([tileId, tile]) => (
                <TileSwatch
                  key={tileId}
                  image={activeImage}
                  frameWidth={selectedTileset?.grid.frameWidth ?? 32}
                  frameHeight={selectedTileset?.grid.frameHeight ?? 32}
                  tile={tile}
                  label={tileId}
                  selected={selectedTileId === tileId}
                  onClick={() => setSelectedTileId(tileId)}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-slate-800 px-6 py-4">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</div>
          <div className="mt-2 text-sm text-slate-200">{status}</div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-slate-800 bg-slate-950/70 px-6 py-4">
          <div className="text-sm text-slate-300">
            Left click to paint the selected tile. Right click to erase from the active layer.
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-950 p-6">
          <div className="inline-block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
            <canvas
              ref={canvasRef}
              onClick={(event) => handleCanvasPointer(event, 'paint')}
              onContextMenu={(event) => {
                event.preventDefault();
                handleCanvasPointer(event, 'erase');
              }}
              className="block max-w-none cursor-crosshair bg-slate-950"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
