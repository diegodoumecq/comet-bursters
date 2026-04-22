import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { readNumber, useSpritesheetEditorStore } from '../state/spritesheetEditorStore';

export function TilePropertiesSection() {
  const addTileEntry = useSpritesheetEditorStore((state) => state.addTileEntry);
  const selectedTileId = useSpritesheetEditorStore((state) => state.selectedTileId);
  const tileEntries = useSpritesheetEditorStore((state) => state.tileEntries);
  const tileset = useSpritesheetEditorStore((state) => state.tileset);
  const updateTileEntry = useSpritesheetEditorStore((state) => state.updateTileEntry);
  const updateTileId = useSpritesheetEditorStore((state) => state.updateTileId);
  const updateTileMaterial = useSpritesheetEditorStore((state) => state.updateTileMaterial);
  const [isOpen, setIsOpen] = useState(true);
  const selectedTileIndex = tileEntries.findIndex((entry) => entry.id === selectedTileId);
  const selectedTile = selectedTileIndex >= 0 ? tileEntries[selectedTileIndex] : null;
  const materialNames = [...(tileset?.materials ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );

  return (
    <CollapsibleSection
      title="Tile Properties"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={addTileEntry}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          >
            Add
          </button>
        </div>

        {selectedTile ? (
          <div className="space-y-4">
            <div className="text-sm text-slate-300">
              Editing{' '}
              <span className="font-semibold text-cyan-200">
                {selectedTile.id.trim() || 'unnamed tile'}
              </span>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Tile
              </div>

              <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                ID
                <input
                  value={selectedTile.id}
                  onChange={(event) => updateTileId(selectedTileIndex, event.currentTarget.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Column
                  <input
                    type="number"
                    min="0"
                    value={selectedTile.column}
                    onChange={(event) =>
                      updateTileEntry(selectedTileIndex, {
                        column: readNumber(event.currentTarget.value),
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Row
                  <input
                    type="number"
                    min="0"
                    value={selectedTile.row}
                    onChange={(event) =>
                      updateTileEntry(selectedTileIndex, {
                        row: readNumber(event.currentTarget.value),
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                  />
                </label>
              </div>

              <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Material
                <select
                  value={selectedTile.material ?? ''}
                  onChange={(event) =>
                    updateTileMaterial(selectedTile.id, event.currentTarget.value)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                >
                  <option value="">No material</option>
                  {materialNames.map((materialName) => (
                    <option key={materialName} value={materialName}>
                      {materialName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Use the adjacency preview to assign side groups and inspect directional matches.
            </p>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Select a tile to edit its properties.</div>
        )}
      </div>
    </CollapsibleSection>
  );
}
