export function clipImageData(source: ImageData, width: number, height: number): ImageData {
  const clippedWidth = Math.max(1, Math.min(width, source.width));
  const clippedHeight = Math.max(1, Math.min(height, source.height));
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = source.width;
  sourceCanvas.height = source.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    return new ImageData(clippedWidth, clippedHeight);
  }

  sourceCtx.putImageData(source, 0, 0);
  return sourceCtx.getImageData(0, 0, clippedWidth, clippedHeight);
}
