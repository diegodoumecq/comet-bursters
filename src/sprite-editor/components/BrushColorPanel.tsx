import type { RgbaColor } from '../state/spriteEditorStore';

export function BrushColorPanel({
  activeHexColor,
  brushColor,
  onColorChange,
}: {
  activeHexColor: string;
  brushColor: RgbaColor;
  onColorChange: (hexColor: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <label className="flex items-center gap-3 text-xs text-slate-300">
        <span className="uppercase tracking-[0.18em] text-slate-500">Color</span>
        <input
          type="color"
          value={activeHexColor}
          onChange={(event) => onColorChange(event.currentTarget.value)}
          className="h-10 w-10 rounded-lg border-0 bg-transparent p-0"
        />
      </label>
      <div
        className="h-10 w-10 rounded-xl border border-white/15"
        style={{
          backgroundColor: `rgba(${brushColor.r}, ${brushColor.g}, ${brushColor.b}, ${
            brushColor.a / 255
          })`,
        }}
      />
      <div className="text-sm text-slate-300">
        <div>{activeHexColor.toUpperCase()}</div>
        <div className="text-xs text-slate-500">
          rgba({brushColor.r}, {brushColor.g}, {brushColor.b}, {(brushColor.a / 255).toFixed(2)})
        </div>
      </div>
    </div>
  );
}
