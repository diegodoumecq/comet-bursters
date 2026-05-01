export function ZoomPanel({
  onCenter,
  onZoomChange,
  zoom,
}: {
  onCenter: () => void;
  onZoomChange: (zoom: number) => void;
  zoom: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 xl:justify-end">
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <span className="uppercase tracking-[0.18em] text-slate-500">Zoom</span>
        <input
          type="number"
          min="2"
          max="48"
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.currentTarget.value) || zoom)}
          className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
        <span className="text-xs text-slate-500">x</span>
      </label>
      <button
        type="button"
        onClick={onCenter}
        className="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-600"
      >
        Center
      </button>
    </div>
  );
}
