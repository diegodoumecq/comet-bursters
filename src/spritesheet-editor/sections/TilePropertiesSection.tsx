import { useEffect, useMemo, useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { getTileTopologySpecificity } from '../../editor/shared/autotile';
import { shipInteriorTileAssets } from '../../scenes/ShipInteriorScene/tileAssets';
import { readNumber, useSpritesheetEditorStore } from '../state/spritesheetEditorStore';

export function TilePropertiesSection() {
  const addTileEntry = useSpritesheetEditorStore((state) => state.addTileEntry);
  const duplicateSelectedTile = useSpritesheetEditorStore((state) => state.duplicateSelectedTile);
  const selectedTileId = useSpritesheetEditorStore((state) => state.selectedTileId);
  const tileEntries = useSpritesheetEditorStore((state) => state.tileEntries);
  const tileset = useSpritesheetEditorStore((state) => state.tileset);
  const updateTileEntry = useSpritesheetEditorStore((state) => state.updateTileEntry);
  const updateTileId = useSpritesheetEditorStore((state) => state.updateTileId);
  const updateTileMaterial = useSpritesheetEditorStore((state) => state.updateTileMaterial);
  const updateTileTopologyEnabled = useSpritesheetEditorStore(
    (state) => state.updateTileTopologyEnabled,
  );
  const updateTileVariantGroup = useSpritesheetEditorStore((state) => state.updateTileVariantGroup);
  const updateTileVariantWeight = useSpritesheetEditorStore(
    (state) => state.updateTileVariantWeight,
  );
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const selectedTileIndex = tileEntries.findIndex((entry) => entry.id === selectedTileId);
  const selectedTile = selectedTileIndex >= 0 ? tileEntries[selectedTileIndex] : null;
  const selectedTileLabel = selectedTile?.id.trim() || 'unnamed tile';
  const selectedAsset = useMemo(
    () =>
      tileset
        ? (shipInteriorTileAssets.find((asset) => asset.imageSrc === tileset.imageSrc) ?? null)
        : null,
    [tileset],
  );
  const materialNames = [...(tileset?.materials ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );
  const grid = tileset?.grid;
  const frameWidth = grid?.frameWidth ?? 32;
  const frameHeight = grid?.frameHeight ?? 32;
  const offsetX = grid?.offsetX ?? 0;
  const offsetY = grid?.offsetY ?? 0;
  const gapX = grid?.gapX ?? 0;
  const gapY = grid?.gapY ?? 0;
  const largestFrameSide = Math.max(1, frameWidth, frameHeight);
  const selectedTilePreviewScale = Math.max(1, Math.min(6, Math.floor(80 / largestFrameSide)));

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

  return (
    <CollapsibleSection
      title="Tile Properties"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={duplicateSelectedTile}
            disabled={!selectedTile}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
          >
            Dupe
          </button>
          <button
            type="button"
            onClick={addTileEntry}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
          >
            Create
          </button>
        </div>

        {selectedTile ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              {image ? (
                <div
                  className="relative shrink-0 overflow-hidden rounded-lg border border-cyan-300/50 bg-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                  style={{
                    height: frameHeight * selectedTilePreviewScale,
                    width: frameWidth * selectedTilePreviewScale,
                  }}
                  title={selectedTileLabel}
                >
                  <img
                    src={image.src}
                    alt={selectedTileLabel}
                    draggable={false}
                    className="absolute max-w-none"
                    style={{
                      height: image.height * selectedTilePreviewScale,
                      imageRendering: 'pixelated',
                      left:
                        -(offsetX + selectedTile.column * (frameWidth + gapX)) *
                        selectedTilePreviewScale,
                      top:
                        -(offsetY + selectedTile.row * (frameHeight + gapY)) *
                        selectedTilePreviewScale,
                      width: image.width * selectedTilePreviewScale,
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/70 text-center text-xs text-slate-600">
                  No image
                </div>
              )}
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

            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Autotile
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">
                    Match this tile against surrounding material cells instead of choosing it only
                    by hand.
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedTile.topology !== undefined}
                    onChange={(event) =>
                      updateTileTopologyEnabled(selectedTile.id, event.currentTarget.checked)
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                  />
                  Enabled
                </label>
              </div>

              {selectedTile.topology !== undefined ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Variant Group
                      <input
                        value={selectedTile.variantGroup ?? ''}
                        onChange={(event) =>
                          updateTileVariantGroup(selectedTile.id, event.currentTarget.value)
                        }
                        placeholder="wall_corner_up_right"
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                      />
                    </label>
                    <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Variant Weight
                      <input
                        type="number"
                        min="0"
                        value={selectedTile.variantWeight ?? 1}
                        onChange={(event) =>
                          updateTileVariantWeight(
                            selectedTile.id,
                            readNumber(event.currentTarget.value),
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-[11px] leading-5 text-slate-400">
                    Specificity {getTileTopologySpecificity(selectedTile.topology)}. `same` means
                    the neighbor has the same material. `different` means any other material or an
                    empty cell. Edit the directional relations directly in the topology preview on
                    the right.
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 p-3 text-sm text-slate-500">
                  Autotile is disabled for this tile. It can still be placed manually.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Select a tile to edit its properties.</div>
        )}
      </div>
    </CollapsibleSection>
  );
}
