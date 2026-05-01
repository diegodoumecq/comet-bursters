import { getBrushStampBounds, getStrokeSegmentBounds } from './history';
import type {
  PixelRect,
  RgbaColor,
  SpriteEditorTool,
} from './state/spriteEditorStore';
import {
  cloneImageData,
  cropImageData,
  drawImageDataAtOffset,
  drawSelectionAtOffset,
  getPixelColor,
  normalizeSelectionRect,
  paintLine,
  paintPoint,
} from './utils';

export type PixelPoint = { x: number; y: number };

export type MoveDragOrigin = {
  startOffsetX: number;
  startOffsetY: number;
  startX: number;
  startY: number;
};

export function beginSelectionInteraction(point: PixelPoint): PixelRect {
  return { x: point.x, y: point.y, width: 1, height: 1 };
}

export function updateSelectionInteraction(
  selectionOrigin: PixelPoint,
  point: PixelPoint,
): PixelRect {
  return normalizeSelectionRect(selectionOrigin, point);
}

export function beginMoveInteraction({
  ctx,
  isSelectionCopy,
  moveOffset,
  moveSourceImage,
  point,
  selectionRect,
}: {
  ctx: CanvasRenderingContext2D;
  isSelectionCopy: boolean;
  moveOffset: { x: number; y: number };
  moveSourceImage: ImageData | null;
  point: PixelPoint;
  selectionRect: PixelRect | null;
}): {
  moveDragOrigin: MoveDragOrigin;
  nextMoveSourceImage: ImageData;
  nextSelectionPixels: ImageData | null;
} {
  const nextMoveSourceImage =
    !selectionRect || !isSelectionCopy ? cloneImageData(ctx) : (moveSourceImage ?? cloneImageData(ctx));
  const nextSelectionPixels =
    selectionRect && !isSelectionCopy ? cropImageData(nextMoveSourceImage, selectionRect) : null;

  return {
    moveDragOrigin: {
      startOffsetX: moveOffset.x,
      startOffsetY: moveOffset.y,
      startX: point.x,
      startY: point.y,
    },
    nextMoveSourceImage,
    nextSelectionPixels,
  };
}

export function updateMoveInteraction({
  ctx,
  isSelectionCopy,
  moveOrigin,
  moveSourceImage,
  point,
  selectionPixels,
  selectionRect,
}: {
  ctx: CanvasRenderingContext2D;
  isSelectionCopy: boolean;
  moveOrigin: MoveDragOrigin;
  moveSourceImage: ImageData;
  point: PixelPoint;
  selectionPixels: ImageData | null;
  selectionRect: PixelRect | null;
}): { x: number; y: number } {
  const nextOffset = {
    x: moveOrigin.startOffsetX + (point.x - moveOrigin.startX),
    y: moveOrigin.startOffsetY + (point.y - moveOrigin.startY),
  };

  if (selectionRect && selectionPixels) {
    drawSelectionAtOffset(ctx, moveSourceImage, selectionRect, selectionPixels, nextOffset, {
      clearSourceRect: !isSelectionCopy,
    });
  } else {
    drawImageDataAtOffset(ctx, moveSourceImage, nextOffset);
  }

  return nextOffset;
}

export function beginPaintInteraction({
  activeTool,
  brushColor,
  brushSize,
  ctx,
  point,
}: {
  activeTool: SpriteEditorTool;
  brushColor: RgbaColor;
  brushSize: number;
  ctx: CanvasRenderingContext2D;
  point: PixelPoint;
}): { historyBounds: PixelRect; lastPointer: PixelPoint } {
  paintPoint(ctx, point.x, point.y, brushSize, activeTool, brushColor);
  return {
    historyBounds: getBrushStampBounds(point.x, point.y, brushSize),
    lastPointer: point,
  };
}

export function updatePaintInteraction({
  brushColor,
  brushSize,
  ctx,
  point,
  previousPoint,
  tool,
}: {
  brushColor: RgbaColor;
  brushSize: number;
  ctx: CanvasRenderingContext2D;
  point: PixelPoint;
  previousPoint: PixelPoint;
  tool: SpriteEditorTool;
}): { historyBounds: PixelRect; lastPointer: PixelPoint } {
  paintLine(ctx, previousPoint, point, brushSize, tool, brushColor);
  return {
    historyBounds: getStrokeSegmentBounds(previousPoint, point, brushSize),
    lastPointer: point,
  };
}

export function finalizeSelectionInteraction({
  moveSourceImage,
  selectionRect,
}: {
  moveSourceImage: ImageData | null;
  selectionRect: PixelRect | null;
}): { isSelectionCopy: boolean; selectionPixels: ImageData | null } {
  if (!moveSourceImage || !selectionRect) {
    return { isSelectionCopy: false, selectionPixels: null };
  }

  return {
    isSelectionCopy: false,
    selectionPixels: cropImageData(moveSourceImage, selectionRect),
  };
}

export function pickColorAtPoint(
  ctx: CanvasRenderingContext2D,
  point: PixelPoint,
): RgbaColor {
  return getPixelColor(ctx, point.x, point.y);
}
