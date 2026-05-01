import type { RgbaColor, SpriteEditorTool as Tool } from '../state/spriteEditorStore';
import { paintPoint } from './paintPoint';

export function paintLine(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  brushSize: number,
  tool: Tool,
  color: RgbaColor,
) {
  let x = start.x;
  let y = start.y;
  const deltaX = Math.abs(end.x - start.x);
  const deltaY = Math.abs(end.y - start.y);
  const stepX = start.x < end.x ? 1 : -1;
  const stepY = start.y < end.y ? 1 : -1;
  let error = deltaX - deltaY;

  while (true) {
    paintPoint(ctx, x, y, brushSize, tool, color);
    if (x === end.x && y === end.y) {
      break;
    }

    const doubledError = error * 2;
    if (doubledError > -deltaY) {
      error -= deltaY;
      x += stepX;
    }
    if (doubledError < deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}
