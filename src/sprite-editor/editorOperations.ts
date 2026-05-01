import { applyHistoryStepToCanvas, pasteClipboardImageToCanvas, resizeCanvasDocument, revertCanvasToImage, saveSpriteAssetImage } from './documentCommands';
import type { PixelRect } from './state/spriteEditorStore';
import { cloneImageData, imageDataToBlob } from './utils';
import type { SpriteHistoryEntry } from './history';

type SpriteEditorDocumentSession = {
  isSelectionCopy: boolean;
  moveSourceImageData: ImageData | null;
  originalImageData: ImageData | null;
  selectionPixels: ImageData | null;
};

export async function copySelectionToClipboard({
  selectionImage,
}: {
  selectionImage: ImageData | null;
}): Promise<{ error: string | null; message: string | null }> {
  if (!selectionImage) {
    return { error: null, message: null };
  }

  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return {
      error: 'Clipboard image copy is not supported in this browser.',
      message: null,
    };
  }

  const blob = await imageDataToBlob(selectionImage);
  if (!blob) {
    return { error: 'Failed to copy the current selection.', message: null };
  }

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  return { error: null, message: 'Copied selection to clipboard.' };
}

export async function pasteSelectionFromClipboard({
  beginDocumentHistorySession,
  blob,
  ctx,
  preferredPosition,
}: {
  beginDocumentHistorySession: (label: string) => void;
  blob: Blob;
  ctx: CanvasRenderingContext2D;
  preferredPosition: { x: number; y: number };
}): Promise<{ clippedImage: ImageData | null; error: string | null; pasteRect: PixelRect | null }> {
  beginDocumentHistorySession('Paste');
  const pasteResult = await pasteClipboardImageToCanvas({ blob, ctx, preferredPosition });
  if (!pasteResult.clippedImage || !pasteResult.pasteRect) {
    return {
      clippedImage: null,
      error: 'Failed to read clipboard image.',
      pasteRect: null,
    };
  }

  return { clippedImage: pasteResult.clippedImage, error: null, pasteRect: pasteResult.pasteRect };
}

export function selectAssetPath({
  activeAssetPath,
  dirty,
  nextAssetPath,
}: {
  activeAssetPath: string | null;
  dirty: boolean;
  nextAssetPath: string;
}): string | null {
  if (nextAssetPath === activeAssetPath) {
    return null;
  }
  if (dirty && !window.confirm('Discard unsaved sprite changes?')) {
    return null;
  }

  return nextAssetPath;
}

export function applyUndoRedoStep({
  ctx,
  direction,
  entry,
}: {
  ctx: CanvasRenderingContext2D;
  direction: 'undo' | 'redo';
  entry: SpriteHistoryEntry;
}): ImageData {
  return applyHistoryStepToCanvas({ ctx, direction, entry });
}

export function revertEditorDocument({
  ctx,
  originalImageData,
}: {
  ctx: CanvasRenderingContext2D;
  originalImageData: ImageData;
}): ImageData {
  return revertCanvasToImage(ctx, originalImageData);
}

export async function saveEditorDocument({
  assetPath,
  canvas,
}: {
  assetPath: string;
  canvas: HTMLCanvasElement;
}): Promise<{ originalImageData: ImageData | null }> {
  await saveSpriteAssetImage(assetPath, canvas.toDataURL('image/png'));
  const ctx = canvas.getContext('2d');
  return { originalImageData: ctx ? cloneImageData(ctx) : null };
}

export function promptResizeDimensions(canvas: HTMLCanvasElement): {
  error: string | null;
  message: string | null;
  nextHeight: number | null;
  nextWidth: number | null;
} {
  const widthInput = window.prompt('New canvas width in pixels', String(canvas.width));
  if (widthInput === null) {
    return { error: null, message: null, nextHeight: null, nextWidth: null };
  }

  const nextWidth = Number.parseInt(widthInput, 10);
  if (!Number.isFinite(nextWidth) || nextWidth < 1) {
    return {
      error: 'Canvas width must be a positive integer.',
      message: null,
      nextHeight: null,
      nextWidth: null,
    };
  }

  const heightInput = window.prompt('New canvas height in pixels', String(canvas.height));
  if (heightInput === null) {
    return { error: null, message: null, nextHeight: null, nextWidth: null };
  }

  const nextHeight = Number.parseInt(heightInput, 10);
  if (!Number.isFinite(nextHeight) || nextHeight < 1) {
    return {
      error: 'Canvas height must be a positive integer.',
      message: null,
      nextHeight: null,
      nextWidth: null,
    };
  }

  if (nextWidth === canvas.width && nextHeight === canvas.height) {
    return {
      error: null,
      message: 'Canvas size unchanged.',
      nextHeight: null,
      nextWidth: null,
    };
  }

  return { error: null, message: null, nextHeight, nextWidth };
}

export function resizeEditorDocument({
  ctx,
  nextHeight,
  nextWidth,
}: {
  ctx: CanvasRenderingContext2D;
  nextHeight: number;
  nextWidth: number;
}): ImageData {
  return resizeCanvasDocument({ ctx, nextHeight, nextWidth });
}

export async function runCopySelection({
  getCanvasSelectionImageData,
  setLoadError,
  setMessage,
}: {
  getCanvasSelectionImageData: () => ImageData | null;
  setLoadError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
}) {
  const result = await copySelectionToClipboard({
    selectionImage: getCanvasSelectionImageData(),
  });
  if (!result.error && !result.message) {
    return;
  }
  setLoadError(result.error);
  setMessage(result.message);
}

export async function runPasteSelection({
  beginDocumentHistorySession,
  blob,
  commitMoveOffset,
  ctx,
  finalizeCurrentHistorySession,
  preferredPosition,
  resetInteractionRefs,
  session,
  setDirty,
  setLoadError,
  setMessage,
  setMoveOffset,
  setSelectionRect,
  setTool,
  syncCanvasSelectionSnapshot,
}: {
  beginDocumentHistorySession: (label: string) => void;
  blob: Blob;
  commitMoveOffset: () => void;
  ctx: CanvasRenderingContext2D | null | undefined;
  finalizeCurrentHistorySession: () => void;
  preferredPosition: { x: number; y: number };
  resetInteractionRefs: () => void;
  session: SpriteEditorDocumentSession;
  setDirty: (dirty: boolean) => void;
  setLoadError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setMoveOffset: (offset: { x: number; y: number }) => void;
  setSelectionRect: (rect: PixelRect | null) => void;
  setTool: (tool: 'move') => void;
  syncCanvasSelectionSnapshot: (ctx: CanvasRenderingContext2D, rect: PixelRect | null) => void;
}) {
  if (!ctx) {
    return;
  }

  commitMoveOffset();
  const pasteResult = await pasteSelectionFromClipboard({
    beginDocumentHistorySession,
    blob,
    ctx,
    preferredPosition,
  });
  if (!pasteResult.clippedImage || !pasteResult.pasteRect) {
    setLoadError(pasteResult.error);
    return;
  }

  syncCanvasSelectionSnapshot(ctx, null);
  session.selectionPixels = pasteResult.clippedImage;
  session.isSelectionCopy = true;
  resetInteractionRefs();
  setSelectionRect(pasteResult.pasteRect);
  setMoveOffset({ x: 0, y: 0 });
  setTool('move');
  setDirty(true);
  setLoadError(null);
  setMessage('Pasted clipboard image.');
  finalizeCurrentHistorySession();
}

export function runSelectAsset({
  activeAssetPath,
  dirty,
  nextAssetPath,
  setActiveAssetPath,
}: {
  activeAssetPath: string | null;
  dirty: boolean;
  nextAssetPath: string;
  setActiveAssetPath: (path: string) => void;
}) {
  const selectedAssetPath = selectAssetPath({ activeAssetPath, dirty, nextAssetPath });
  if (selectedAssetPath) {
    setActiveAssetPath(selectedAssetPath);
  }
}

export function runUndoRedo({
  ctx,
  direction,
  discardCurrentHistorySession,
  entry,
  session,
  resetSelectionState,
  setDirty,
  setRedoStack,
  setUndoStack,
}: {
  ctx: CanvasRenderingContext2D | null | undefined;
  direction: 'undo' | 'redo';
  discardCurrentHistorySession: () => void;
  entry: SpriteHistoryEntry | undefined;
  session: SpriteEditorDocumentSession;
  resetSelectionState: () => void;
  setDirty: (dirty: boolean) => void;
  setRedoStack: (updater: (current: SpriteHistoryEntry[]) => SpriteHistoryEntry[]) => void;
  setUndoStack: (updater: (current: SpriteHistoryEntry[]) => SpriteHistoryEntry[]) => void;
}) {
  if (!ctx || !entry) {
    return;
  }

  discardCurrentHistorySession();
  session.moveSourceImageData = applyUndoRedoStep({ ctx, direction, entry });
  if (direction === 'undo') {
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, entry].slice(-50));
  } else {
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, entry].slice(-50));
  }
  resetSelectionState();
  setDirty(true);
}

export function runRevert({
  ctx,
  dirty,
  discardCurrentHistorySession,
  originalImageData,
  session,
  resetSelectionState,
  setDirty,
  setMessage,
  setRedoStack,
  setUndoStack,
}: {
  ctx: CanvasRenderingContext2D | null | undefined;
  dirty: boolean;
  discardCurrentHistorySession: () => void;
  originalImageData: ImageData | null;
  session: SpriteEditorDocumentSession;
  resetSelectionState: () => void;
  setDirty: (dirty: boolean) => void;
  setMessage: (message: string) => void;
  setRedoStack: (entries: []) => void;
  setUndoStack: (entries: []) => void;
}) {
  if (!ctx || !originalImageData) {
    return;
  }
  if (dirty && !window.confirm('Revert all unsaved changes for this image?')) {
    return;
  }

  session.moveSourceImageData = revertEditorDocument({ ctx, originalImageData });
  discardCurrentHistorySession();
  setUndoStack([]);
  setRedoStack([]);
  setDirty(false);
  resetSelectionState();
  setMessage('Reverted to the last saved image.');
}

export async function runSave({
  activeAsset,
  canvas,
  cloneCanvasImage,
  commitMoveOffset,
  discardCurrentHistorySession,
  isLoading,
  isSaving,
  moveOffset,
  session,
  resetInteractionRefs,
  selectionRect,
  setDirty,
  setIsSaving,
  setLoadError,
  setMessage,
  setMoveOffset,
  syncCanvasSelectionSnapshot,
}: {
  activeAsset: { assetPath: string; fileName: string } | null;
  canvas: HTMLCanvasElement | null;
  cloneCanvasImage: () => ImageData | null;
  commitMoveOffset: () => void;
  discardCurrentHistorySession: () => void;
  isLoading: boolean;
  isSaving: boolean;
  moveOffset: { x: number; y: number };
  session: SpriteEditorDocumentSession;
  resetInteractionRefs: () => void;
  selectionRect: PixelRect | null;
  setDirty: (dirty: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setLoadError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setMoveOffset: (offset: { x: number; y: number }) => void;
  syncCanvasSelectionSnapshot: (ctx: CanvasRenderingContext2D, rect: PixelRect | null) => void;
}) {
  if (!canvas || !activeAsset || isLoading || isSaving) {
    return;
  }
  if (moveOffset.x !== 0 || moveOffset.y !== 0) {
    commitMoveOffset();
  }

  setIsSaving(true);
  setMessage(null);
  setLoadError(null);
  try {
    const saveResult = await saveEditorDocument({
      assetPath: activeAsset.assetPath,
      canvas,
    });
    session.originalImageData = saveResult.originalImageData ?? cloneCanvasImage();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      syncCanvasSelectionSnapshot(ctx, selectionRect);
    }
    discardCurrentHistorySession();
    setDirty(false);
    resetInteractionRefs();
    setMoveOffset({ x: 0, y: 0 });
    setMessage(`Saved ${activeAsset.fileName}.`);
  } catch (error) {
    setLoadError(error instanceof Error ? error.message : 'Failed to save image.');
  } finally {
    setIsSaving(false);
  }
}

export function runResizeCanvas({
  beginDocumentHistorySession,
  canvas,
  commitMoveOffset,
  ctx,
  finalizeCurrentHistorySession,
  moveOffset,
  resetSelectionState,
  session,
  setDirty,
  setHoveredPixel,
  setIsActionsOpen,
  setLoadError,
  setMessage,
  syncCenterCanvas,
}: {
  beginDocumentHistorySession: (label: string) => void;
  canvas: HTMLCanvasElement | null;
  commitMoveOffset: () => void;
  ctx: CanvasRenderingContext2D | null | undefined;
  finalizeCurrentHistorySession: () => void;
  moveOffset: { x: number; y: number };
  resetSelectionState: () => void;
  session: SpriteEditorDocumentSession;
  setDirty: (dirty: boolean) => void;
  setHoveredPixel: (point: { x: number; y: number } | null) => void;
  setIsActionsOpen: (open: boolean) => void;
  setLoadError: (message: string | null) => void;
  setMessage: (message: string) => void;
  syncCenterCanvas: () => void;
}) {
  if (!canvas || !ctx) {
    return;
  }
  if (moveOffset.x !== 0 || moveOffset.y !== 0) {
    commitMoveOffset();
  }

  const resizePrompt = promptResizeDimensions(canvas);
  if (resizePrompt.error) {
    setLoadError(resizePrompt.error);
    return;
  }
  if (resizePrompt.message) {
    setMessage(resizePrompt.message);
    return;
  }
  if (resizePrompt.nextWidth === null || resizePrompt.nextHeight === null) {
    return;
  }

  beginDocumentHistorySession('Resize');
  session.moveSourceImageData = resizeEditorDocument({
    ctx,
    nextHeight: resizePrompt.nextHeight,
    nextWidth: resizePrompt.nextWidth,
  });
  session.selectionPixels = null;
  session.isSelectionCopy = false;
  setDirty(true);
  setLoadError(null);
  setHoveredPixel(null);
  resetSelectionState();
  setMessage(`Resized canvas to ${resizePrompt.nextWidth} x ${resizePrompt.nextHeight}.`);
  setIsActionsOpen(false);
  finalizeCurrentHistorySession();
  window.requestAnimationFrame(syncCenterCanvas);
}
