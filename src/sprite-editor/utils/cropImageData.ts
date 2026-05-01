import type { PixelRect } from '../state/spriteEditorStore';

export function cropImageData(source: ImageData, rect: PixelRect): ImageData {
  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = source.width;
  scratchCanvas.height = source.height;
  const scratchCtx = scratchCanvas.getContext('2d');
  if (!scratchCtx) {
    return new ImageData(rect.width, rect.height);
  }

  scratchCtx.putImageData(source, 0, 0);
  return scratchCtx.getImageData(rect.x, rect.y, rect.width, rect.height);
}
