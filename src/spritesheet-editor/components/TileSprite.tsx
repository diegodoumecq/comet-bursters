import type { TileEntry } from '../state/spritesheetEditorStore';

export function TileSprite({
  frameHeight,
  frameWidth,
  gapX,
  gapY,
  image,
  offsetX,
  offsetY,
  scale,
  tile,
}: {
  frameHeight: number;
  frameWidth: number;
  gapX: number;
  gapY: number;
  image: HTMLImageElement | null;
  offsetX: number;
  offsetY: number;
  scale: number;
  tile: TileEntry;
}) {
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
}
