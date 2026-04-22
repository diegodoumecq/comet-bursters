import { useEffect, useMemo, useState } from 'react';

import { ConfirmationDialog } from '@/ui/components/ConfirmationDialog';
import { DropdownMenu } from '@/ui/components/DropdownMenu';
import { shipInteriorTileAssets } from '../scenes/ShipInteriorScene/tileAssets';
import { GridSection } from './sections/GridSection';
import { MatchingGroupsSection } from './sections/MatchingGroupsSection';
import { MaterialsSection } from './sections/MaterialsSection';
import { PreviewZoomSection } from './sections/PreviewZoomSection';
import { TilePropertiesSection } from './sections/TilePropertiesSection';
import { TilesSection } from './sections/TilesSection';
import { TilesetSection } from './sections/TilesetSection';
import {
  oppositeDirections,
  type AdjacencyDirection,
  type TileEntry,
  useSpritesheetEditorStore,
} from './state/spritesheetEditorStore';

export function SpritesheetEditorApp() {
  const canRedo = useSpritesheetEditorStore((state) => state.futureDocuments.length > 0);
  const canUndo = useSpritesheetEditorStore((state) => state.pastDocuments.length > 0);
  const createNewTileset = useSpritesheetEditorStore((state) => state.createNewTileset);
  const deleteTileEntry = useSpritesheetEditorStore((state) => state.deleteTileEntry);
  const previewMode = useSpritesheetEditorStore((state) => state.previewMode);
  const previewZoom = useSpritesheetEditorStore((state) => state.previewZoom);
  const redo = useSpritesheetEditorStore((state) => state.redo);
  const resetEditor = useSpritesheetEditorStore((state) => state.resetEditor);
  const saveTileset = useSpritesheetEditorStore((state) => state.saveTileset);
  const selectedTileId = useSpritesheetEditorStore((state) => state.selectedTileId);
  const setPreviewMode = useSpritesheetEditorStore((state) => state.setPreviewMode);
  const setSelectedTileId = useSpritesheetEditorStore((state) => state.setSelectedTileId);
  const setTileDeleteIndex = useSpritesheetEditorStore((state) => state.setTileDeleteIndex);
  const tileDeleteIndex = useSpritesheetEditorStore((state) => state.tileDeleteIndex);
  const tileEntries = useSpritesheetEditorStore((state) => state.tileEntries);
  const tileset = useSpritesheetEditorStore((state) => state.tileset);
  const undo = useSpritesheetEditorStore((state) => state.undo);
  const updateTileMatchingGroup = useSpritesheetEditorStore(
    (state) => state.updateTileMatchingGroup,
  );
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
  const matchingGroupNames = [...(tileset?.matchingGroups ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );
  const getResolvedMatchingTiles = (tileId: string, direction: AdjacencyDirection): string[] => {
    const groupName = tileEntries.find((entry) => entry.id === tileId)?.adjacency?.[direction];
    if (!tileset || !groupName) {
      return [];
    }

    const oppositeDirection = oppositeDirections[direction];
    return tileEntries
      .map((entry) => entry.id)
      .filter((candidateTileId) => {
        const candidateGroupName = tileEntries.find((entry) => entry.id === candidateTileId)
          ?.adjacency?.[oppositeDirection];
        return candidateGroupName === groupName;
      });
  };
  const getResolvedMatchingTileEntries = (
    tileId: string,
    direction: AdjacencyDirection,
  ): TileEntry[] => {
    const resolvedTileIds = new Set(getResolvedMatchingTiles(tileId, direction));
    return tileEntries.filter((entry) => resolvedTileIds.has(entry.id));
  };
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
  const largestFrameSide = Math.max(1, frameWidth, frameHeight);
  const adjacencyCenterScale = Math.max(1, Math.min(6, Math.floor(128 / largestFrameSide)));
  const adjacencyMatchScale = Math.max(1, Math.min(4, Math.floor(64 / largestFrameSide)));
  const renderTileSprite = (tile: TileEntry, scale: number) => {
    if (!image) {
      return null;
    }

    const left = (offsetX + tile.column * (frameWidth + gapX)) * scale;
    const top = (offsetY + tile.row * (frameHeight + gapY)) * scale;

    return (
      <div
        className="relative shrink-0 overflow-hidden border border-slate-700 bg-slate-950"
        style={{
          height: frameHeight * scale,
          width: frameWidth * scale,
        }}
      >
        <img
          src={image.src}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            height: image.height * scale,
            imageRendering: 'pixelated',
            left: -left,
            top: -top,
            width: image.width * scale,
          }}
        />
      </div>
    );
  };
  const renderAdjacencyMatches = (direction: AdjacencyDirection) => {
    const matches = selectedTile ? getResolvedMatchingTileEntries(selectedTile.id, direction) : [];

    return (
      <div className="flex min-h-32 flex-col rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {direction}
          </div>
          <div className="text-[11px] text-slate-500">{matches.length} matches</div>
        </div>
        {selectedTile ? (
          <select
            value={selectedTile.adjacency?.[direction] ?? ''}
            onChange={(event) =>
              updateTileMatchingGroup(selectedTile.id, direction, event.currentTarget.value)
            }
            className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          >
            <option value="">No group</option>
            {matchingGroupNames.map((groupName) => (
              <option key={groupName} value={groupName}>
                {groupName}
              </option>
            ))}
          </select>
        ) : null}
        {matches.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {matches.map((match, index) => (
              <button
                key={`${direction}-${match.id}-${index}`}
                type="button"
                onClick={() => setSelectedTileId(match.id)}
                className="rounded-lg border border-transparent p-1 text-left transition hover:border-cyan-300/60 hover:bg-cyan-500/10"
                title={`${match.id} [${match.column}, ${match.row}]`}
              >
                {renderTileSprite(match, adjacencyMatchScale)}
                <div className="mt-1 max-w-16 truncate text-[10px] text-slate-400">
                  {match.id.trim() || 'unnamed'}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-800 px-3 py-4 text-center text-xs text-slate-600">
            No matches
          </div>
        )}
      </div>
    );
  };

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
              <DropdownMenu
                align="left"
                isOpen={isHeaderMenuOpen}
                onClose={() => setIsHeaderMenuOpen(false)}
                onToggle={() => setIsHeaderMenuOpen((current) => !current)}
                menuClassName="rounded-xl"
                trigger={
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:border-slate-500 hover:text-white"
                    aria-label="More options"
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
                      <path d="M3 5h14" />
                      <path d="M3 10h14" />
                      <path d="M3 15h14" />
                    </svg>
                  </span>
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    void saveTileset();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    createNewTileset();
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setIsResetModalOpen(true);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/15"
                >
                  Reset
                </button>
              </DropdownMenu>
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
            <PreviewZoomSection />
            <TilesSection />
            <MaterialsSection />
            <MatchingGroupsSection />
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
              <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1">
                {(
                  [
                    ['sheet', 'Sheet'],
                    ['adjacency', 'Adjacency'],
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
              {image ? (
                <div className="text-xs text-slate-500">
                  {image.width} x {image.height}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {image && previewMode === 'sheet' ? (
              <div className="h-full w-full overflow-auto border border-slate-800 bg-slate-950">
                <div className="flex min-h-full min-w-full items-center justify-center">
                  <div
                    className="relative shrink-0"
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
                        const tile = tileEntries.find(
                          (entry) => entry.column === column && entry.row === row,
                        );
                        const isSelected =
                          selectedTile?.column === column && selectedTile.row === row;
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
                </div>
              </div>
            ) : null}

            {image && previewMode === 'adjacency' ? (
              <div className="h-full w-full overflow-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                {selectedTile ? (
                  <div className="grid min-h-full min-w-176 grid-cols-[minmax(10rem,1fr)_auto_minmax(10rem,1fr)] grid-rows-[auto_auto_auto] items-center gap-4">
                    <div className="col-start-2">{renderAdjacencyMatches('up')}</div>
                    <div className="col-start-1 row-start-2">{renderAdjacencyMatches('left')}</div>
                    <div className="col-start-2 row-start-2 flex flex-col items-center justify-center gap-3 rounded-2xl border border-cyan-300/50 bg-cyan-500/10 p-5">
                      {renderTileSprite(selectedTile, adjacencyCenterScale)}
                      <div className="max-w-44 text-center">
                        <div className="truncate text-sm font-semibold text-cyan-100">
                          {selectedTile.id.trim() || 'unnamed tile'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Column {selectedTile.column}, row {selectedTile.row}
                        </div>
                      </div>
                    </div>
                    <div className="col-start-3 row-start-2">{renderAdjacencyMatches('right')}</div>
                    <div className="col-start-2 row-start-3">{renderAdjacencyMatches('down')}</div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Select a tile to preview adjacency matches.
                  </div>
                )}
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
          tilePendingDelete?.id.trim() || 'this tile'
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
