import { useSpriteEditorStore, type PixelRect } from '../state/spriteEditorStore';

export function SpriteEditorFooter({
  canvasSizeLabel,
  displayedSelectionRect,
  hoveredPixel,
}: {
  canvasSizeLabel: string;
  displayedSelectionRect: PixelRect | null;
  hoveredPixel: { x: number; y: number } | null;
}) {
  const brushSize = useSpriteEditorStore((state) => state.brushSize);
  const tool = useSpriteEditorStore((state) => state.tool);
  const zoom = useSpriteEditorStore((state) => state.zoom);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
      <div className="flex flex-wrap items-center gap-4">
        <div>Canvas {canvasSizeLabel}</div>
        <div>Tool {tool}</div>
        <div>Brush {brushSize}px</div>
        <div>Zoom {zoom}x</div>
        <div>
          Selection {displayedSelectionRect ? `${displayedSelectionRect.width} x ${displayedSelectionRect.height}` : '—'}
        </div>
        <div>Cursor {hoveredPixel ? `${hoveredPixel.x}, ${hoveredPixel.y}` : '—'}</div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.16em] text-slate-500">
        <span>`Alt` pick</span>
        <span>`Space` drag</span>
        <span>`V` move</span>
        <span>`M` select</span>
        <span>`Wheel` pan</span>
        <span>`Cmd/Ctrl+Wheel` zoom</span>
        <span>`[` `]` brush</span>
        <span>`Cmd/Ctrl+S` save</span>
      </div>
    </div>
  );
}
