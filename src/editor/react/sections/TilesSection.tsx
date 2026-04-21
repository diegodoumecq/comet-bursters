import { useState } from 'react';

import { getTilesetForLayer } from '../../shared/levelEditing';
import { useEditorStore } from '../../state/editorStore';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { TileSwatch } from '../TileSwatch';

export function TilesSection() {
  const activeImage = useEditorStore((state) => {
    const selectedTileset = getTilesetForLayer(state.level, state.selectedLayerId);
    return selectedTileset ? state.images[selectedTileset.id] : null;
  });
  const applyAssetPath = useEditorStore((state) => state.applyAssetPath);
  const assetPathInput = useEditorStore((state) => state.assetPathInput);
  const inactiveLayerOpacity = useEditorStore((state) => state.inactiveLayerOpacity);
  const layerVisibility = useEditorStore((state) => state.layerVisibility);
  const level = useEditorStore((state) => state.level);
  const pickTilesetPng = useEditorStore((state) => state.pickTilesetPng);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const selectedTileset = useEditorStore((state) =>
    getTilesetForLayer(state.level, state.selectedLayerId),
  );
  const setAssetPathInput = useEditorStore((state) => state.setAssetPathInput);
  const setInactiveLayerOpacity = useEditorStore((state) => state.setInactiveLayerOpacity);
  const setLayerVisibility = useEditorStore((state) => state.setLayerVisibility);
  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const setSelectedTileId = useEditorStore((state) => state.setSelectedTileId);
  const selectedTiles = selectedTileset ? Object.entries(selectedTileset.tiles) : [];
  const [isLayerOpen, setIsLayerOpen] = useState(true);
  const [isAssetOpen, setIsAssetOpen] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);

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
          <div className="mt-2 text-xs text-slate-500">
            Applies to visible tile layers except the selected layer.
          </div>
        </div>
        <div className="grid gap-2">
          {level.layers.map((layer) => {
            const isVisible = layerVisibility[layer.id] !== false;
            return (
              <div
                key={layer.id}
                className={`flex items-center gap-2 rounded-xl border p-2 text-sm ${
                selectedLayerId === layer.id
                  ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
              }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="font-medium">{layer.id}</div>
                  <div className="text-xs text-slate-500">
                    {layer.hasCollision ? 'Collidable' : 'Visual only'} • {layer.tiles.length}{' '}
                    tiles
                  </div>
                </button>
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
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Tileset Asset"
        isOpen={isAssetOpen}
        onToggle={() => setIsAssetOpen((current) => !current)}
      >
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
              onClick={applyAssetPath}
              className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              Apply Path
            </button>
            <label className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-center text-sm text-slate-200 hover:border-slate-500">
              Pick PNG
              <input
                className="hidden"
                type="file"
                accept="image/png"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  pickTilesetPng(file);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Palette"
        isOpen={isPaletteOpen}
        onToggle={() => setIsPaletteOpen((current) => !current)}
      >
        <div className="flex items-center justify-between">
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
      </CollapsibleSection>
    </>
  );
}
