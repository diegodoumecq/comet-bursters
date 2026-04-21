export function TileSwatch({
  image,
  frameWidth,
  frameHeight,
  tile,
  label,
  selected,
  onClick,
}: {
  image: HTMLImageElement | null;
  frameWidth: number;
  frameHeight: number;
  tile: [number, number];
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const scale = 1.5;
  const previewWidth = frameWidth * scale;
  const previewHeight = frameHeight * scale;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-2 rounded-xl border p-2 text-left transition ${
        selected
          ? 'border-cyan-300 bg-cyan-500/15 shadow-[0_0_0_1px_rgba(103,232,249,0.4)]'
          : 'border-slate-700 bg-slate-900/70 hover:border-slate-500 hover:bg-slate-800/70'
      }`}
    >
      <div className="flex h-16 items-center justify-center rounded-lg bg-slate-950/80">
        {image ? (
          <div
            className="overflow-hidden rounded"
            style={{ width: previewWidth, height: previewHeight }}
          >
            <img
              src={image.src}
              alt={label}
              draggable={false}
              style={{
                maxWidth: 'none',
                width: image.width * scale,
                height: image.height * scale,
                transform: `translate(${-tile[0] * previewWidth}px, ${-tile[1] * previewHeight}px)`,
                imageRendering: 'pixelated',
              }}
            />
          </div>
        ) : (
          <span className="text-xs text-slate-500">No preview</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-100">{label}</div>
      </div>
    </button>
  );
}
