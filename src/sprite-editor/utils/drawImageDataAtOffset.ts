export function drawImageDataAtOffset(
  ctx: CanvasRenderingContext2D,
  source: ImageData,
  offset: { x: number; y: number },
) {
  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = source.width;
  scratchCanvas.height = source.height;
  const scratchCtx = scratchCanvas.getContext('2d');
  if (!scratchCtx) {
    return;
  }

  scratchCtx.putImageData(source, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratchCanvas, offset.x, offset.y);
}
