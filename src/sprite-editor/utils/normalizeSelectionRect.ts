import type { PixelRect } from '../state/spriteEditorStore';

export function normalizeSelectionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): PixelRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  return {
    x: left,
    y: top,
    width: Math.abs(end.x - start.x) + 1,
    height: Math.abs(end.y - start.y) + 1,
  };
}
