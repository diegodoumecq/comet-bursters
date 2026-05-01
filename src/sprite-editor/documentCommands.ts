import {
  applyHistoryEntry,
  createDocumentHistorySession,
  createPatchHistorySession,
  extendPatchHistorySession,
  finalizeHistorySession,
  type PendingSpriteHistorySession,
  type SpriteHistoryEntry,
} from './history';
import type { PixelRect } from './state/spriteEditorStore';
import { blobToImageData, clipImageData, cloneImageData, cropImageData } from './utils';

export type MoveCommitResult = {
  moveSourceImage: ImageData;
  nextMoveOffset: { x: number; y: number };
  nextSelectionPixels: ImageData | null;
  nextSelectionRect: PixelRect | null;
};

export type { PendingSpriteHistorySession, SpriteHistoryEntry };
type HistorySessionState = { pendingHistorySession: PendingSpriteHistorySession | null };

export function commitMoveOffsetToCanvas({
  ctx,
  isSelectionCopy,
  moveOffset,
  moveSourceImage,
  selectionPixels,
  selectionRect,
}: {
  ctx: CanvasRenderingContext2D;
  isSelectionCopy: boolean;
  moveOffset: { x: number; y: number };
  moveSourceImage: ImageData | null;
  selectionPixels: ImageData | null;
  selectionRect: PixelRect | null;
}): MoveCommitResult {
  if (moveOffset.x === 0 && moveOffset.y === 0) {
    const nextMoveSourceImage = cloneImageData(ctx);
    return {
      moveSourceImage: nextMoveSourceImage,
      nextMoveOffset: { x: 0, y: 0 },
      nextSelectionPixels: selectionRect ? cropImageData(nextMoveSourceImage, selectionRect) : null,
      nextSelectionRect: selectionRect,
    };
  }

  const committedImage = cloneImageData(ctx);
  if (!selectionRect) {
    return {
      moveSourceImage: committedImage,
      nextMoveOffset: { x: 0, y: 0 },
      nextSelectionPixels: null,
      nextSelectionRect: null,
    };
  }

  const nextSelectionRect = {
    ...selectionRect,
    x: selectionRect.x + moveOffset.x,
    y: selectionRect.y + moveOffset.y,
  };

  if (!isSelectionCopy || !moveSourceImage) {
    return {
      moveSourceImage: committedImage,
      nextMoveOffset: { x: 0, y: 0 },
      nextSelectionPixels: cropImageData(committedImage, nextSelectionRect),
      nextSelectionRect,
    };
  }

  const backgroundPixels = cropImageData(moveSourceImage, nextSelectionRect);
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = committedImage.width;
  baseCanvas.height = committedImage.height;
  const baseCtx = baseCanvas.getContext('2d');
  const nextMoveSourceImage = baseCtx
    ? (() => {
        baseCtx.putImageData(committedImage, 0, 0);
        baseCtx.putImageData(backgroundPixels, nextSelectionRect.x, nextSelectionRect.y);
        return baseCtx.getImageData(0, 0, committedImage.width, committedImage.height);
      })()
    : committedImage;

  return {
    moveSourceImage: nextMoveSourceImage,
    nextMoveOffset: { x: 0, y: 0 },
    nextSelectionPixels: selectionPixels ?? cropImageData(committedImage, nextSelectionRect),
    nextSelectionRect,
  };
}

export async function pasteClipboardImageToCanvas({
  blob,
  ctx,
  preferredPosition,
}: {
  blob: Blob;
  ctx: CanvasRenderingContext2D;
  preferredPosition: { x: number; y: number };
}): Promise<{ clippedImage: ImageData | null; pasteRect: PixelRect | null }> {
  const pastedImage = await blobToImageData(blob);
  if (!pastedImage) {
    return { clippedImage: null, pasteRect: null };
  }

  const clippedImage =
    pastedImage.width > ctx.canvas.width || pastedImage.height > ctx.canvas.height
      ? clipImageData(pastedImage, ctx.canvas.width, ctx.canvas.height)
      : pastedImage;
  const pasteRect = {
    x: Math.max(0, Math.min(preferredPosition.x, ctx.canvas.width - clippedImage.width)),
    y: Math.max(0, Math.min(preferredPosition.y, ctx.canvas.height - clippedImage.height)),
    width: clippedImage.width,
    height: clippedImage.height,
  };

  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = clippedImage.width;
  scratchCanvas.height = clippedImage.height;
  const scratchCtx = scratchCanvas.getContext('2d');
  if (!scratchCtx) {
    return { clippedImage: null, pasteRect: null };
  }

  scratchCtx.putImageData(clippedImage, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratchCanvas, pasteRect.x, pasteRect.y);
  return { clippedImage, pasteRect };
}

export function applyHistoryStepToCanvas({
  ctx,
  direction,
  entry,
}: {
  ctx: CanvasRenderingContext2D;
  direction: 'undo' | 'redo';
  entry: SpriteHistoryEntry;
}): ImageData {
  applyHistoryEntry(ctx, entry, direction);
  return cloneImageData(ctx);
}

export function revertCanvasToImage(
  ctx: CanvasRenderingContext2D,
  originalImageData: ImageData,
): ImageData {
  ctx.putImageData(originalImageData, 0, 0);
  return cloneImageData(ctx);
}

export function resizeCanvasDocument({
  ctx,
  nextHeight,
  nextWidth,
}: {
  ctx: CanvasRenderingContext2D;
  nextHeight: number;
  nextWidth: number;
}): ImageData {
  const previousSnapshot = cloneImageData(ctx);
  const resizeSource = document.createElement('canvas');
  resizeSource.width = ctx.canvas.width;
  resizeSource.height = ctx.canvas.height;
  resizeSource.getContext('2d')?.putImageData(previousSnapshot, 0, 0);

  ctx.canvas.width = nextWidth;
  ctx.canvas.height = nextHeight;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, nextWidth, nextHeight);
  ctx.drawImage(resizeSource, 0, 0);
  return cloneImageData(ctx);
}

export async function saveSpriteAssetImage(assetPath: string, pngDataUrl: string): Promise<void> {
  const response = await fetch('/__editor/save-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assetPath,
      pngDataUrl,
    }),
  });

  if (response.ok) {
    return;
  }

  const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(errorPayload?.error ?? 'Failed to save image');
}

export function beginPatchHistorySession({
  bounds,
  canvas,
  label,
  session,
}: {
  bounds: PixelRect;
  canvas: HTMLCanvasElement | null;
  label: string;
  session: HistorySessionState;
}) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) {
    return;
  }

  session.pendingHistorySession = createPatchHistorySession(ctx, bounds, label);
}

export function extendCurrentPatchHistorySession({
  bounds,
  canvas,
  session,
}: {
  bounds: PixelRect;
  canvas: HTMLCanvasElement | null;
  session: HistorySessionState;
}) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) {
    return;
  }

  session.pendingHistorySession = extendPatchHistorySession(session.pendingHistorySession, ctx, bounds);
}

export function beginDocumentHistorySession({
  canvas,
  label,
  session,
}: {
  canvas: HTMLCanvasElement | null;
  label: string;
  session: HistorySessionState;
}) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) {
    return;
  }

  session.pendingHistorySession = createDocumentHistorySession(ctx, label);
}

export function finalizeCurrentHistorySession({
  canvas,
  session,
  setRedoStack,
  setUndoStack,
}: {
  canvas: HTMLCanvasElement | null;
  session: HistorySessionState;
  setRedoStack: (updater: (current: SpriteHistoryEntry[]) => SpriteHistoryEntry[]) => void;
  setUndoStack: (updater: (current: SpriteHistoryEntry[]) => SpriteHistoryEntry[]) => void;
}) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) {
    session.pendingHistorySession = null;
    return;
  }

  const entry = finalizeHistorySession(ctx, session.pendingHistorySession);
  if (entry) {
    setUndoStack((current) => [...current, entry].slice(-50));
    setRedoStack(() => []);
  }
  session.pendingHistorySession = null;
}

export function discardCurrentHistorySession(session: HistorySessionState) {
  session.pendingHistorySession = null;
}
