export function BrushSettingsPanel({
  alphaPercent,
  brushSize,
  onAlphaChange,
  onBrushSizeChange,
}: {
  alphaPercent: number;
  brushSize: number;
  onAlphaChange: (percent: number) => void;
  onBrushSizeChange: (brushSize: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <span className="uppercase tracking-[0.18em] text-slate-500">Opacity</span>
        <input
          type="number"
          min="0"
          max="100"
          value={alphaPercent}
          onChange={(event) => onAlphaChange(Number(event.currentTarget.value) || 0)}
          className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
        <span className="text-xs text-slate-500">%</span>
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <span className="uppercase tracking-[0.18em] text-slate-500">Brush</span>
        <input
          type="number"
          min="1"
          max="12"
          value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.currentTarget.value) || 1)}
          className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
        <span className="text-xs text-slate-500">px</span>
      </label>
    </div>
  );
}
