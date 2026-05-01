export function SpriteEditorActionsMenu({
  canvasSizeLabel,
  isOpen,
  onResizeCanvas,
  onToggle,
}: {
  canvasSizeLabel: string;
  isOpen: boolean;
  onResizeCanvas: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
      >
        Actions
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-52 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-slate-950/60">
          <button
            type="button"
            onClick={onResizeCanvas}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-900/90"
          >
            <span>Resize canvas…</span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {canvasSizeLabel}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
