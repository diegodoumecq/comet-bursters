import type { RgbaColor, SpriteEditorTool as Tool } from '../state/spriteEditorStore';

export function paintPoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brushSize: number,
  tool: Tool,
  color: RgbaColor,
) {
  const halfBrush = Math.floor(brushSize / 2);
  if (tool === 'erase') {
    ctx.clearRect(x - halfBrush, y - halfBrush, brushSize, brushSize);
    return;
  }

  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
  ctx.fillRect(x - halfBrush, y - halfBrush, brushSize, brushSize);
}
