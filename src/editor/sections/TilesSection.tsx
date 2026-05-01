import { useRef, useState } from 'react';

import { getTilesetTilePositionMap } from '../../scenes/ShipInteriorScene/level';
import { bundledTilesets } from '../../scenes/ShipInteriorScene/tilesetCatalog';
import type { EditorTilesetDefinition } from '../shared/editorTileset';
import { getTilesetForLayer } from '../shared/levelEditing';
import { useEditorStore } from '../state/editorStore';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { TileSwatch } from '../TileSwatch';
import { LayerActionsMenu } from './LayerActionsMenu';

type LayerDefinition = ReturnType<typeof useEditorStore.getState>['level']['layers'][number];

function isLayerDefinition(layer: LayerDefinition | undefined): layer is LayerDefinition {
  return Boolean(layer);
}

function makeLayerId(level: ReturnType<typeof useEditorStore.getState>['level']): string {
  let nextIndex = level.layers.length + 1;
  let nextId = `layer-${nextIndex}`;

  while (level.layers.some((layer) => layer.id === nextId)) {
    nextIndex += 1;
    nextId = `layer-${nextIndex}`;
  }

  return nextId;
}

export function TilesSection({ showPalette = true }: { showPalette?: boolean }) {
  const { setInactiveLayerOpacity, setLayerVisibility, setLevel, setSelectedLayerId, setSelectedTileId } =
    useEditorStore((state) => state.handlers);
  const activeImage = useEditorStore((state) => {
    const selectedTileset = getTilesetForLayer(state.level, state.selectedLayerId);
    return selectedTileset ? state.images[selectedTileset.id] : null;
  });
  const inactiveLayerOpacity = useEditorStore((state) => state.inactiveLayerOpacity);
  const layerVisibility = useEditorStore((state) => state.layerVisibility);
  const level = useEditorStore((state) => state.level);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const selectedTileset = useEditorStore((state) =>
    getTilesetForLayer(state.level, state.selectedLayerId),
  );
  const selectedTiles = selectedTileset
    ? selectedTileset.tiles.map((tile) => ({
        id: tile.id,
        label: tile.name,
        tile: getTilesetTilePositionMap(selectedTileset)[String(tile.id)],
      }))
    : [];
  const [openLayerMenuId, setOpenLayerMenuId] = useState<string | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renamingLayerValue, setRenamingLayerValue] = useState('');
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragLayerOrder, setDragLayerOrder] = useState<string[] | null>(null);
  const dragLayerOrderRef = useRef<string[] | null>(null);
  const [isLayerOpen, setIsLayerOpen] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const tilesetFileOptions = bundledTilesets
    .map((entry) => ({
      ...entry,
      tileset: entry.tileset as EditorTilesetDefinition,
    }))
    .filter((entry) => level.tilesets.some((tileset) => tileset.id === entry.tileset.id))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
  const renderedLayers = dragLayerOrder
    ? dragLayerOrder
        .map((layerId) => level.layers.find((layer) => layer.id === layerId))
        .filter(isLayerDefinition)
    : level.layers;

  const saveLayerRename = (layerId: string) => {
    const nextId = renamingLayerValue.trim();
    if (!nextId) {
      alert('Layer name cannot be empty');
      return;
    }
    if (nextId === layerId) {
      setRenamingLayerId(null);
      setRenamingLayerValue('');
      return;
    }
    if (level.layers.some((layer) => layer.id === nextId)) {
      alert(`Layer "${nextId}" already exists`);
      return;
    }

    setLevel((currentLevel) => ({
      ...currentLevel,
      layers: currentLevel.layers.map((layer) =>
        layer.id === layerId ? { ...layer, id: nextId } : layer,
      ),
    }));
    if (selectedLayerId === layerId) {
      setSelectedLayerId(nextId);
    }
    setLayerVisibility(nextId, layerVisibility[layerId] !== false);
    setRenamingLayerId(null);
    setRenamingLayerValue('');
  };

  const clearLayerDragState = () => {
    setDraggedLayerId(null);
    setDragLayerOrder(null);
    dragLayerOrderRef.current = null;
  };

  const moveDraggedLayerBefore = (targetLayerId: string) => {
    if (!draggedLayerId || draggedLayerId === targetLayerId) {
      return;
    }

    setDragLayerOrder((currentOrder) => {
      const order = currentOrder ?? level.layers.map((layer) => layer.id);
      const sourceIndex = order.indexOf(draggedLayerId);
      const targetIndex = order.indexOf(targetLayerId);

      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
        return order;
      }

      const nextOrder = [...order];
      const [movedLayerId] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, movedLayerId);
      dragLayerOrderRef.current = nextOrder;
      return nextOrder;
    });
  };

  const commitLayerOrder = () => {
    const committedOrder = dragLayerOrderRef.current ?? dragLayerOrder;
    if (!committedOrder) {
      clearLayerDragState();
      return;
    }

    setLevel((currentLevel) => ({
      ...currentLevel,
      layers: committedOrder
        .map((layerId) => currentLevel.layers.find((layer) => layer.id === layerId))
        .filter(isLayerDefinition),
    }));
    clearLayerDragState();
  };

  const updateLayerTileset = (layerId: string, tilesetId: string) => {
    setLevel((currentLevel) => {
      const nextTileset = currentLevel.tilesets.find((tileset) => tileset.id === tilesetId);
      if (!nextTileset) {
        return currentLevel;
      }

      if (selectedLayerId === layerId) {
        const [firstTileId] = Object.keys(getTilesetTilePositionMap(nextTileset));
        setSelectedTileId(firstTileId ? Number.parseInt(firstTileId, 10) : null);
      }

      return {
        ...currentLevel,
        layers: currentLevel.layers.map((candidate) =>
          candidate.id === layerId ? { ...candidate, tilesetId } : candidate,
        ),
      };
    });
  };

  return (
    <>
      <CollapsibleSection
        title="Layer"
        isOpen={isLayerOpen}
        onToggle={() => setIsLayerOpen((current) => !current)}
      >
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Inactive Layer Opacity
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(inactiveLayerOpacity * 100)}
              onChange={(event) => setInactiveLayerOpacity(Number(event.target.value) / 100)}
              className="min-w-0 flex-1"
            />
            <span className="w-10 text-right text-sm text-slate-400">
              {Math.round(inactiveLayerOpacity * 100)}%
            </span>
          </div>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              const nextLayerId = makeLayerId(level);
              const tilesetId = selectedTileset?.id ?? level.tilesets[0]?.id;
              if (!tilesetId) {
                alert('Cannot create a layer without a tileset.');
                return;
              }

              setLevel((currentLevel) => ({
                ...currentLevel,
                layers: [
                  {
                    id: nextLayerId,
                    hasCollision: false,
                    overhead: false,
                    opacity: 1,
                    tilesetId,
                    tiles: [],
                  },
                  ...currentLevel.layers,
                ],
              }));
              setSelectedLayerId(nextLayerId);
              setOpenLayerMenuId(null);
              setRenamingLayerId(nextLayerId);
              setRenamingLayerValue(nextLayerId);
            }}
            className="flex items-center gap-3 rounded-xl border border-dashed border-cyan-400/40 bg-cyan-500/5 px-4 py-3 text-left text-sm text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-500/10"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/40 bg-slate-950/80">
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
                <path d="M10 4v12" />
                <path d="M4 10h12" />
              </svg>
            </span>
            <span>
              <span className="block font-medium">Create layer</span>
            </span>
          </button>
          {renderedLayers.map((layer) => {
            const isVisible = layerVisibility[layer.id] !== false;
            const isDragging = draggedLayerId === layer.id;
            return (
              <div
                key={layer.id}
                draggable={renamingLayerId !== layer.id && openLayerMenuId !== layer.id}
                onDragStart={(event) => {
                  if ((event.target as HTMLElement).closest('[data-layer-control="true"]')) {
                    event.preventDefault();
                    return;
                  }

                  const initialOrder = level.layers.map((currentLayer) => currentLayer.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', layer.id);
                  setDraggedLayerId(layer.id);
                  setDragLayerOrder(initialOrder);
                  dragLayerOrderRef.current = initialOrder;
                }}
                onDragOver={(event) => {
                  if (!draggedLayerId || draggedLayerId === layer.id) {
                    return;
                  }

                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  moveDraggedLayerBefore(layer.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  commitLayerOrder();
                }}
                onDragEnd={commitLayerOrder}
                className={`flex cursor-grab items-center gap-2 rounded-xl border p-2 text-sm transition active:cursor-grabbing ${
                  selectedLayerId === layer.id
                    ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                    : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                } ${isDragging ? 'scale-[0.98] opacity-50' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  {renamingLayerId === layer.id ? (
                    <input
                      autoFocus
                      value={renamingLayerValue}
                      onChange={(event) => setRenamingLayerValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          saveLayerRename(layer.id);
                        }
                        if (event.key === 'Escape') {
                          setRenamingLayerId(null);
                          setRenamingLayerValue('');
                        }
                      }}
                      className="w-full rounded-lg border border-amber-300 bg-slate-950/90 px-2 py-1 text-sm text-slate-100 outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedLayerId(layer.id)}
                      className="block w-full text-left"
                    >
                      <div className="font-medium">{layer.id}</div>
                      <div className="text-xs text-slate-500">
                        {layer.hasCollision ? 'Collidable' : 'Decor'} •{' '}
                        {layer.overhead ? 'Overhead •' : ''}
                        {layer.scaleToGrid ? 'Scaled •' : ''} {layer.tiles.length}u •{' '}
                        {Math.round((layer.opacity ?? 1) * 100)}%
                      </div>
                    </button>
                  )}
                  <label
                    data-layer-control="true"
                    className="mt-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500"
                  >
                    Tileset
                    <select
                      value={layer.tilesetId}
                      onChange={(event) => updateLayerTileset(layer.id, event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                    >
                      <option value="" disabled>
                        Select tileset
                      </option>
                      {tilesetFileOptions.map((entry) => (
                        <option key={entry.fileName} value={entry.tileset.id}>
                          {entry.fileName}
                        </option>
                      ))}
                      {layer.tilesetId &&
                      !tilesetFileOptions.some((entry) => entry.tileset.id === layer.tilesetId) ? (
                        <option value={layer.tilesetId}>{layer.tilesetId}</option>
                      ) : null}
                    </select>
                  </label>
                  <label
                    data-layer-control="true"
                    className="mt-2 flex items-center gap-2 text-xs text-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={layer.scaleToGrid ?? false}
                      onChange={(event) => {
                        const scaleToGrid = event.currentTarget.checked;
                        setLevel((currentLevel) => ({
                          ...currentLevel,
                          layers: currentLevel.layers.map((candidate) =>
                            candidate.id === layer.id
                              ? {
                                  ...candidate,
                                  scaleToGrid: scaleToGrid ? true : undefined,
                                }
                              : candidate,
                          ),
                        }));
                      }}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400"
                    />
                    <span>Scale tiles to grid</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setLayerVisibility(layer.id, !isVisible)}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                    isVisible
                      ? 'border-slate-700 bg-slate-950/70 text-slate-200 hover:border-slate-500'
                      : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:border-slate-600'
                  }`}
                  aria-label={isVisible ? `Hide ${layer.id}` : `Show ${layer.id}`}
                  title={isVisible ? 'Hide layer' : 'Show layer'}
                >
                  {isVisible ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.5 10s2.5-4.5 7.5-4.5S17.5 10 17.5 10s-2.5 4.5-7.5 4.5S2.5 10 2.5 10Z" />
                      <circle cx="10" cy="10" r="2.25" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.5 10s2.5-4.5 7.5-4.5S17.5 10 17.5 10s-2.5 4.5-7.5 4.5S2.5 10 2.5 10Z" />
                      <circle cx="10" cy="10" r="2.25" />
                      <path d="m4 16 12-12" />
                    </svg>
                  )}
                </button>
                <LayerActionsMenu
                  isOpen={openLayerMenuId === layer.id}
                  isCollidable={layer.hasCollision}
                  isOverhead={layer.overhead ?? false}
                  layerId={layer.id}
                  onClose={() => setOpenLayerMenuId(null)}
                  onDelete={() => {
                    const remainingLayers = level.layers.filter(
                      (candidate) => candidate.id !== layer.id,
                    );
                    setLevel((currentLevel) => ({
                      ...currentLevel,
                      layers: currentLevel.layers.filter(
                        (candidate) => candidate.id !== layer.id,
                      ),
                    }));
                    if (selectedLayerId === layer.id) {
                      setSelectedLayerId(remainingLayers[0]?.id ?? null);
                    }
                    setOpenLayerMenuId(null);
                    if (renamingLayerId === layer.id) {
                      setRenamingLayerId(null);
                      setRenamingLayerValue('');
                    }
                  }}
                  onOpacityChange={(opacity) => {
                    setLevel((currentLevel) => ({
                      ...currentLevel,
                      layers: currentLevel.layers.map((candidate) =>
                        candidate.id === layer.id ? { ...candidate, opacity } : candidate,
                      ),
                    }));
                  }}
                  onRename={() => {
                    setRenamingLayerId(layer.id);
                    setRenamingLayerValue(layer.id);
                    setOpenLayerMenuId(null);
                  }}
                  onToggle={() =>
                    setOpenLayerMenuId(openLayerMenuId === layer.id ? null : layer.id)
                  }
                  onToggleCollision={() => {
                    setLevel((currentLevel) => ({
                      ...currentLevel,
                      layers: currentLevel.layers.map((candidate) =>
                        candidate.id === layer.id
                          ? { ...candidate, hasCollision: !candidate.hasCollision }
                          : candidate,
                      ),
                    }));
                    setOpenLayerMenuId(null);
                  }}
                  onToggleOverhead={() => {
                    setLevel((currentLevel) => ({
                      ...currentLevel,
                      layers: currentLevel.layers.map((candidate) =>
                        candidate.id === layer.id
                          ? { ...candidate, overhead: !(candidate.overhead ?? false) }
                          : candidate,
                      ),
                    }));
                    setOpenLayerMenuId(null);
                  }}
                  opacity={layer.opacity ?? 1}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {showPalette ? (
        <CollapsibleSection
          title="Palette"
          isOpen={isPaletteOpen}
          onToggle={() => setIsPaletteOpen((current) => !current)}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">{selectedTiles.length} tiles</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {selectedTiles.map(({ id: tileId, label, tile }) => (
              <TileSwatch
                key={tileId}
                image={activeImage}
                frameWidth={selectedTileset?.grid.frameWidth ?? 32}
                frameHeight={selectedTileset?.grid.frameHeight ?? 32}
                tile={tile}
                label={label}
                selected={selectedTileId === tileId}
                onClick={() => setSelectedTileId(tileId)}
              />
            ))}
          </div>
        </CollapsibleSection>
      ) : null}
    </>
  );
}
