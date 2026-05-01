import type { RgbaColor } from '../state/spriteEditorStore';

export function getPixelColor(ctx: CanvasRenderingContext2D, x: number, y: number): RgbaColor {
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
}
