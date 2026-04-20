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
  const level = useEditorStore((state) => state.level);
  const pickTilesetPng = useEditorStore((state) => state.pickTilesetPng);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const selectedTileset = useEditorStore((state) =>
    getTilesetForLayer(state.level, state.selectedLayerId),
  );
  const setAssetPathInput = useEditorStore((state) => state.setAssetPathInput);
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
