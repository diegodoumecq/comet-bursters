import { useMemo } from 'react';

import type { TileEntry } from '../state/spritesheetEditorStore';

export function SheetPreview({
  columns,
  frameHeight,
  frameWidth,
  gapX,
  gapY,
  image,
  offsetX,
  offsetY,
  previewScale,
  rows,
  selectedTile,
  setSelectedTileId,
  tileEntries,
  tilesetId,
}: {
  columns: number;
  frameHeight: number;
  frameWidth: number;
  gapX: number;
  gapY: number;
  image: HTMLImageElement | null;
  offsetX: number;
  offsetY: number;
  previewScale: number;
  rows: number;
  selectedTile: TileEntry | null;
  setSelectedTileId: (tileId: number | null) => void;
  tileEntries: TileEntry[];
  tilesetId: string | undefined;
}) {
  const tileEntriesByPosition = useMemo(
    () =>
      new Map(tileEntries.map((entry) => [`${entry.column}:${entry.row}`, entry])),
    [tileEntries],
  );

  if (!image) {
    return null;
  }

  return (
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
            alt={tilesetId ?? 'spritesheet'}
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
              const tile = tileEntriesByPosition.get(`${column}:${row}`);
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
                  title={
                    tile
                      ? `${tile.name?.trim() || `tile_${tile.id}`} [${column}, ${row}]`
                      : `[${column}, ${row}]`
                  }
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
