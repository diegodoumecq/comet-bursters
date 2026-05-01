import { useSpriteEditorStore } from '../state/spriteEditorStore';
import { clampAlpha, clampBrushSize } from '../utils';

export function BrushSettingsPanel() {
  const brushColor = useSpriteEditorStore((state) => state.brushColor);
  const brushSize = useSpriteEditorStore((state) => state.brushSize);
  const handlers = useSpriteEditorStore((state) => state.handlers);
  const alphaPercent = Math.round((brushColor.a / 255) * 100);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <span className="uppercase tracking-[0.18em] text-slate-500">Opacity</span>
        <input
          type="number"
          min="0"
          max="100"
          value={alphaPercent}
          onChange={(event) => {
            const nextPercent = Number(event.currentTarget.value) || 0;
            const clampedPercent = Math.max(0, Math.min(100, nextPercent));
            handlers.setBrushColor((current) => ({
              ...current,
              a: clampAlpha(Math.round((clampedPercent / 100) * 255)),
            }));
          }}
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
          onChange={(event) =>
            handlers.setBrushSize(clampBrushSize(Number(event.currentTarget.value) || 1))
          }
          className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
        />
        <span className="text-xs text-slate-500">px</span>
      </label>
    </div>
  );
}
