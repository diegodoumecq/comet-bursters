import type { RectangleDragState } from './rectangleDragTypes';
import { getRectangleBorderCells } from './getRectangleBorderCells';
import { getRectangleFilledCells } from './getRectangleFilledCells';

export function getRectangleTargetCells(
  rectangleDrag: RectangleDragState,
  fillRectangleDrag: boolean,
) {
  return fillRectangleDrag
    ? getRectangleFilledCells(
        rectangleDrag.startX,
        rectangleDrag.startY,
        rectangleDrag.endX,
        rectangleDrag.endY,
      )
    : getRectangleBorderCells(
        rectangleDrag.startX,
        rectangleDrag.startY,
        rectangleDrag.endX,
        rectangleDrag.endY,
      );
}
