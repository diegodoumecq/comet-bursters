import type { PixelRect } from '../state/spriteEditorStore';

export function drawSelectionAtOffset(
  ctx: CanvasRenderingContext2D,
  source: ImageData,
  selectionRect: PixelRect,
  selectionPixels: ImageData,
  offset: { x: number; y: number },
  options?: { clearSourceRect?: boolean },
) {
  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = source.width;
  scratchCanvas.height = source.height;
  const scratchCtx = scratchCanvas.getContext('2d');
  if (!scratchCtx) {
    return;
  }

  scratchCtx.putImageData(source, 0, 0);
  if (options?.clearSourceRect ?? true) {
    scratchCtx.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
  }

  const selectionCanvas = document.createElement('canvas');
  selectionCanvas.width = selectionPixels.width;
  selectionCanvas.height = selectionPixels.height;
  const selectionCtx = selectionCanvas.getContext('2d');
  if (!selectionCtx) {
    return;
  }

  selectionCtx.putImageData(selectionPixels, 0, 0);
  scratchCtx.imageSmoothingEnabled = false;
  scratchCtx.drawImage(selectionCanvas, selectionRect.x + offset.x, selectionRect.y + offset.y);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratchCanvas, 0, 0);
}
