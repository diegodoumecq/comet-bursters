import type { PixelRect } from './state/spriteEditorStore';

export type SpriteHistoryEntry =
  | {
      kind: 'patch';
      label: string;
      bounds: PixelRect;
      before: ImageData;
      after: ImageData;
    }
  | {
      kind: 'document';
      label: string;
      before: ImageData;
      after: ImageData;
    };

export type PendingSpriteHistorySession =
  | {
      kind: 'patch';
      label: string;
      beforeCanvas: ImageData;
      bounds: PixelRect;
    }
  | {
      kind: 'document';
      label: string;
      beforeCanvas: ImageData;
    };

function imageDataEquals(left: ImageData, right: ImageData): boolean {
  if (left.width !== right.width || left.height !== right.height || left.data.length !== right.data.length) {
    return false;
  }

  for (let index = 0; index < left.data.length; index += 1) {
    if (left.data[index] !== right.data[index]) {
      return false;
    }
  }

  return true;
}

function clampBounds(bounds: PixelRect, canvasWidth: number, canvasHeight: number): PixelRect | null {
  const left = Math.max(0, bounds.x);
  const top = Math.max(0, bounds.y);
  const right = Math.min(canvasWidth, bounds.x + bounds.width);
  const bottom = Math.min(canvasHeight, bounds.y + bounds.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function mergeBounds(left: PixelRect, right: PixelRect): PixelRect {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y,
  };
}

function cropImageData(source: ImageData, bounds: PixelRect): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new ImageData(bounds.width, bounds.height);
  }

  ctx.putImageData(source, 0, 0);
  return ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
}

export function createPatchHistorySession(
  ctx: CanvasRenderingContext2D,
  bounds: PixelRect,
  label: string,
): PendingSpriteHistorySession | null {
  const normalizedBounds = clampBounds(bounds, ctx.canvas.width, ctx.canvas.height);
  if (!normalizedBounds) {
    return null;
  }

  return {
    kind: 'patch',
    label,
    beforeCanvas: ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height),
    bounds: normalizedBounds,
  };
}

export function extendPatchHistorySession(
  session: PendingSpriteHistorySession | null,
  ctx: CanvasRenderingContext2D,
  bounds: PixelRect,
): PendingSpriteHistorySession | null {
  if (!session || session.kind !== 'patch') {
    return session;
  }

  const normalizedBounds = clampBounds(bounds, ctx.canvas.width, ctx.canvas.height);
  if (!normalizedBounds) {
    return session;
  }

  return {
    ...session,
    bounds: mergeBounds(session.bounds, normalizedBounds),
  };
}

export function createDocumentHistorySession(
  ctx: CanvasRenderingContext2D,
  label: string,
): PendingSpriteHistorySession {
  return {
    kind: 'document',
    label,
    beforeCanvas: ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height),
  };
}

export function finalizeHistorySession(
  ctx: CanvasRenderingContext2D,
  session: PendingSpriteHistorySession | null,
): SpriteHistoryEntry | null {
  if (!session) {
    return null;
  }

  if (session.kind === 'document') {
    const after = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (imageDataEquals(session.beforeCanvas, after)) {
      return null;
    }

    return {
      kind: 'document',
      label: session.label,
      before: session.beforeCanvas,
      after,
    };
  }

  const after = ctx.getImageData(
    session.bounds.x,
    session.bounds.y,
    session.bounds.width,
    session.bounds.height,
  );
  const before = cropImageData(session.beforeCanvas, session.bounds);
  if (imageDataEquals(before, after)) {
    return null;
  }

  return {
    kind: 'patch',
    label: session.label,
    bounds: session.bounds,
    before,
    after,
  };
}

export function applyHistoryEntry(
  ctx: CanvasRenderingContext2D,
  entry: SpriteHistoryEntry,
  direction: 'undo' | 'redo',
): void {
  if (entry.kind === 'document') {
    const imageData = direction === 'undo' ? entry.before : entry.after;
    if (ctx.canvas.width !== imageData.width || ctx.canvas.height !== imageData.height) {
      ctx.canvas.width = imageData.width;
      ctx.canvas.height = imageData.height;
    }
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  const imageData = direction === 'undo' ? entry.before : entry.after;
  ctx.putImageData(imageData, entry.bounds.x, entry.bounds.y);
}

export function getBrushStampBounds(x: number, y: number, brushSize: number): PixelRect {
  const halfBrush = Math.floor(brushSize / 2);
  return {
    x: x - halfBrush,
    y: y - halfBrush,
    width: brushSize,
    height: brushSize,
  };
}

export function getStrokeSegmentBounds(
  start: { x: number; y: number },
  end: { x: number; y: number },
  brushSize: number,
): PixelRect {
  const halfBrush = Math.floor(brushSize / 2);
  const minX = Math.min(start.x, end.x) - halfBrush;
  const minY = Math.min(start.y, end.y) - halfBrush;
  const maxX = Math.max(start.x, end.x) + halfBrush + 1;
  const maxY = Math.max(start.y, end.y) + halfBrush + 1;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
