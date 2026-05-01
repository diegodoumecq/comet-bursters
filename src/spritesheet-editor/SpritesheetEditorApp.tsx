import { useEffect, useMemo, useState } from 'react';

import { inferSpriteSheetGridSize } from '@/spritesheet';
import { ConfirmationDialog } from '@/ui/components/ConfirmationDialog';
import { shipInteriorTileAssets } from '../scenes/ShipInteriorScene/tileAssets';
import { SheetPreview } from './components/SheetPreview';
import { SpritesheetHeaderMenu } from './components/SpritesheetHeaderMenu';
import { TopologyPreview } from './components/TopologyPreview';
import { GridSection } from './sections/GridSection';
import { MaterialsSection } from './sections/MaterialsSection';
import { TilePropertiesSection } from './sections/TilePropertiesSection';
import { TilesSection } from './sections/TilesSection';
import { TilesetSection } from './sections/TilesetSection';
import { useSpritesheetEditorStore } from './state/spritesheetEditorStore';

export function SpritesheetEditorApp() {
  const {
    createNewTileset,
    deleteTileEntry,
    redo,
    resetEditor,
    saveTileset,
    setPreviewMode,
    setSelectedTileId,
    setTileDeleteIndex,
    undo,
    updatePreviewZoom,
    updateTileTopologyRelation,
  } = useSpritesheetEditorStore((state) => state.handlers);
  const canRedo = useSpritesheetEditorStore((state) => state.futureHistory.length > 0);
  const canUndo = useSpritesheetEditorStore((state) => state.pastHistory.length > 0);
  const previewMode = useSpritesheetEditorStore((state) => state.previewMode);
  const previewZoom = useSpritesheetEditorStore((state) => state.previewZoom);
  const selectedTileId = useSpritesheetEditorStore((state) => state.selectedTileId);
  const tileDeleteIndex = useSpritesheetEditorStore((state) => state.tileDeleteIndex);
  const tileEntries = useSpritesheetEditorStore((state) => state.tileEntries);
  const tileset = useSpritesheetEditorStore((state) => state.tileset);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const selectedAsset = useMemo(
    () =>
      tileset
        ? (shipInteriorTileAssets.find((asset) => asset.imageSrc === tileset.imageSrc) ?? null)
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

  const selectedTileIndex = tileEntries.findIndex((entry) => entry.id === selectedTileId);
  const selectedTile = selectedTileIndex >= 0 ? tileEntries[selectedTileIndex] : null;
  const tilePendingDelete =
    tileDeleteIndex === null ? null : (tileEntries[tileDeleteIndex] ?? null);
  const grid = tileset?.grid;
  const frameWidth = grid?.frameWidth ?? 32;
  const frameHeight = grid?.frameHeight ?? 32;
  const offsetX = grid?.offsetX ?? 0;
  const offsetY = grid?.offsetY ?? 0;
  const gapX = grid?.gapX ?? 0;
  const gapY = grid?.gapY ?? 0;
  const inferredGridSize =
    image && grid
      ? inferSpriteSheetGridSize(image.width, image.height, {
          frameWidth,
          frameHeight,
          offsetX,
          offsetY,
          gapX,
          gapY,
        })
      : { columns: 0, rows: 0 };
  const columns = inferredGridSize.columns;
  const rows = inferredGridSize.rows;
  const previewScale = previewZoom;
  const largestFrameSide = Math.max(1, frameWidth, frameHeight);
  const topologyZoomScale = previewZoom / 2;
  const topologyCenterScale =
    Math.max(1, Math.min(6, Math.floor(128 / largestFrameSide))) * topologyZoomScale;
  const topologyVariantScale =
    Math.max(1, Math.min(4, Math.floor(64 / largestFrameSide))) * topologyZoomScale;

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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:border-slate-500 hover:text-white not-disabled:cursor-pointer disabled:opacity-40"
                aria-label="Undo"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 6 4 10l4 4" />
                  <path d="M5 10h6a5 5 0 1 1 0 10" />
                </svg>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:border-slate-500 hover:text-white not-disabled:cursor-pointer disabled:opacity-40"
                aria-label="Redo"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12 6 4 4-4 4" />
                  <path d="M15 10H9a5 5 0 1 0 0 10" />
                </svg>
              </button>
              <SpritesheetHeaderMenu
                isOpen={isHeaderMenuOpen}
                onClose={() => setIsHeaderMenuOpen(false)}
                onCreateNew={() => {
                  setIsHeaderMenuOpen(false);
                  createNewTileset();
                }}
                onReset={() => {
                  setIsHeaderMenuOpen(false);
                  setIsResetModalOpen(true);
                }}
                onSave={() => {
                  setIsHeaderMenuOpen(false);
                  void saveTileset();
                }}
                onToggle={() => setIsHeaderMenuOpen((current) => !current)}
              />
            </div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Spritesheet Editor
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-white">Tileset Definition</h1>
        </div>

        {tileset ? (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <TilesetSection />
            <GridSection />
            <TilesSection />
            <MaterialsSection />
            <TilePropertiesSection />
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-400">No tileset JSON files found.</div>
        )}
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden bg-slate-950 p-8">
        <div className="flex h-full min-h-0 w-full flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50">
          <div className="mb-4 flex items-center justify-between gap-6">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Preview
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {selectedAsset?.fileName ?? 'No PNG selected'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-2 py-1">
                <button
                  type="button"
                  onClick={() => updatePreviewZoom(previewZoom - 0.5)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800/70 hover:text-white"
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
                  className="w-28"
                  aria-label="Preview zoom"
                />
                <button
                  type="button"
                  onClick={() => updatePreviewZoom(previewZoom + 0.5)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800/70 hover:text-white"
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
                  className="rounded-lg px-2 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800/70 hover:text-white"
                >
                  {Math.round(previewZoom * 100)}%
                </button>
              </div>
              <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1 2xl:hidden">
                {(
                  [
                    ['sheet', 'Sheet'],
                    ['topology', 'Topology'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPreviewMode(mode)}
                    className={`rounded-lg px-3 py-1.5 text-xs transition ${
                      previewMode === mode
                        ? 'bg-cyan-500/20 text-cyan-100'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="hidden rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 2xl:block">
                Sheet + Topology
              </div>
              {image ? (
                <div className="text-xs text-slate-500">
                  {image.width} x {image.height}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {image ? (
              <div className="hidden h-full min-h-0 2xl:grid 2xl:grid-cols-2 2xl:gap-4">
                <div className="min-h-0 overflow-hidden rounded-2xl">
                  <SheetPreview
                    columns={columns}
                    frameHeight={frameHeight}
                    frameWidth={frameWidth}
                    gapX={gapX}
                    gapY={gapY}
                    image={image}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    previewScale={previewScale}
                    rows={rows}
                    selectedTile={selectedTile}
                    setSelectedTileId={setSelectedTileId}
                    tileEntries={tileEntries}
                    tilesetId={tileset?.id}
                  />
                </div>
                <div className="min-h-0 overflow-hidden rounded-2xl">
                  <TopologyPreview
                    frameHeight={frameHeight}
                    frameWidth={frameWidth}
                    gapX={gapX}
                    gapY={gapY}
                    image={image}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    selectedTile={selectedTile}
                    setSelectedTileId={setSelectedTileId}
                    tileEntries={tileEntries}
                    topologyCenterScale={topologyCenterScale}
                    topologyVariantScale={topologyVariantScale}
                    updateTileTopologyRelation={updateTileTopologyRelation}
                  />
                </div>
              </div>
            ) : null}

            {image && previewMode === 'sheet' ? (
              <div className="h-full 2xl:hidden">
                <SheetPreview
                  columns={columns}
                  frameHeight={frameHeight}
                  frameWidth={frameWidth}
                  gapX={gapX}
                  gapY={gapY}
                  image={image}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  previewScale={previewScale}
                  rows={rows}
                  selectedTile={selectedTile}
                  setSelectedTileId={setSelectedTileId}
                  tileEntries={tileEntries}
                  tilesetId={tileset?.id}
                />
              </div>
            ) : null}

            {image && previewMode === 'topology' ? (
              <div className="h-full 2xl:hidden">
                <TopologyPreview
                  frameHeight={frameHeight}
                  frameWidth={frameWidth}
                  gapX={gapX}
                  gapY={gapY}
                  image={image}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  selectedTile={selectedTile}
                  setSelectedTileId={setSelectedTileId}
                  tileEntries={tileEntries}
                  topologyCenterScale={topologyCenterScale}
                  topologyVariantScale={topologyVariantScale}
                  updateTileTopologyRelation={updateTileTopologyRelation}
                />
              </div>
            ) : null}

            {!image ? (
              <div className="flex h-full w-full items-center justify-center border border-slate-800 bg-slate-950 text-sm text-slate-500">
                No spritesheet image loaded.
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <ConfirmationDialog
        isOpen={tilePendingDelete !== null}
        title="Delete tile?"
        message={`This will remove ${
          tilePendingDelete?.name?.trim() || `tile_${tilePendingDelete?.id ?? ''}`
        } from the current tileset.`}
        confirmLabel="Delete"
        onCancel={() => setTileDeleteIndex(null)}
        onConfirm={() => {
          if (tileDeleteIndex !== null) {
            deleteTileEntry(tileDeleteIndex);
          }
        }}
      />

      <ConfirmationDialog
        isOpen={isResetModalOpen}
        title="Reset spritesheet editor?"
        message="This will clear the current spritesheet editor session, including persisted local changes and undo history."
        confirmLabel="Reset"
        onCancel={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          resetEditor();
          setIsResetModalOpen(false);
          setIsHeaderMenuOpen(false);
        }}
      />
    </div>
  );
}
