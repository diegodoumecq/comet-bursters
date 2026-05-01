import { type TileTopologyDirection, tileTopologiesEqual } from '../../editor/shared/autotile';
import type { TileEntry } from '../state/spritesheetEditorStore';
import { TileSprite } from './TileSprite';
import { TopologyCell } from './TopologyCell';

const topologyGrid: Array<Array<TileTopologyDirection | null>> = [
  ['upLeft', 'up', 'upRight'],
  ['left', null, 'right'],
  ['downLeft', 'down', 'downRight'],
];

export function TopologyPreview({
  frameHeight,
  frameWidth,
  gapX,
  gapY,
  image,
  offsetX,
  offsetY,
  selectedTile,
  setSelectedTileId,
  tileEntries,
  topologyCenterScale,
  topologyVariantScale,
  updateTileTopologyRelation,
}: {
  frameHeight: number;
  frameWidth: number;
  gapX: number;
  gapY: number;
  image: HTMLImageElement | null;
  offsetX: number;
  offsetY: number;
  selectedTile: TileEntry | null;
  setSelectedTileId: (tileId: number | null) => void;
  tileEntries: TileEntry[];
  topologyCenterScale: number;
  topologyVariantScale: number;
  updateTileTopologyRelation: (
    tileId: number,
    direction: TileTopologyDirection,
    relation: 'same' | 'different' | 'any',
  ) => void;
}) {
  const topologyVariants =
    selectedTile?.topology !== undefined
      ? tileEntries
          .filter(
            (entry) =>
              entry.material === selectedTile.material &&
              entry.topology !== undefined &&
              tileTopologiesEqual(entry.topology, selectedTile.topology),
          )
          .sort((left, right) => left.name.localeCompare(right.name))
      : [];

  if (!image) {
    return null;
  }

  return (
    <div className="h-full w-full overflow-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      {selectedTile ? (
        selectedTile.topology !== undefined ? (
          <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4">
            <div className="grid w-full grid-cols-3 gap-3 md:gap-4">
              {topologyGrid.flatMap((row, rowIndex) =>
                row.map((direction, columnIndex) =>
                  direction ? (
                    <TopologyCell
                      key={direction}
                      direction={direction}
                      selectedTile={selectedTile}
                      topology={selectedTile.topology}
                      updateTileTopologyRelation={updateTileTopologyRelation}
                    />
                  ) : (
                    <div
                      key={`selected-${rowIndex}-${columnIndex}`}
                      className="flex min-h-24 items-center justify-center rounded-2xl border border-cyan-300/50 bg-cyan-500/10 p-4 md:min-h-28 md:p-5"
                    >
                      <TileSprite
                        frameHeight={frameHeight}
                        frameWidth={frameWidth}
                        gapX={gapX}
                        gapY={gapY}
                        image={image}
                        offsetX={offsetX}
                        offsetY={offsetY}
                        scale={topologyCenterScale}
                        tile={selectedTile}
                      />
                    </div>
                  ),
                ),
              )}
            </div>

            <div className="flex min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Variants
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Tiles with the exact same topology and material.
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">{topologyVariants.length} matches</div>
              </div>

              <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-[11px] leading-5 text-slate-400">
                `same` neighbors share this tile&apos;s material. `different` means empty space or
                another material.
              </div>

              {topologyVariants.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3">
                  {topologyVariants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedTileId(variant.id)}
                      className={`rounded-xl border p-2 text-left transition ${
                        variant.id === selectedTile.id
                          ? 'border-cyan-300 bg-cyan-500/15'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-600'
                      }`}
                      title={`${variant.name?.trim() || `tile_${variant.id}`} [${variant.column}, ${variant.row}]`}
                    >
                      <div className="flex justify-center">
                        <TileSprite
                          frameHeight={frameHeight}
                          frameWidth={frameWidth}
                          gapX={gapX}
                          gapY={gapY}
                          image={image}
                          offsetX={offsetX}
                          offsetY={offsetY}
                          scale={topologyVariantScale}
                          tile={variant}
                        />
                      </div>
                      <div className="mt-2 truncate text-xs text-slate-300">
                        {variant.name?.trim() || `tile_${variant.id}`}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        {variant.variantGroup ?? 'no-group'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        weight {variant.variantWeight ?? 1}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                  No exact topology variants.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
            Autotile is disabled for the selected tile.
          </div>
        )
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Select a tile to preview topology.
        </div>
      )}
    </div>
  );
}
