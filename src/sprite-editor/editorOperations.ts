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
type SpriteEditorAsset = { assetPath: string; fileName: string } | null;
type SpriteHistoryStackSetter = (
  updater: (current: SpriteHistoryEntry[]) => SpriteHistoryEntry[],
) => void;
type SpriteEditorDocumentController = {
  beginDocumentHistorySession: (label: string) => void;
  canvas: HTMLCanvasElement | null;
  cloneCanvasImage: () => ImageData | null;
  commitMoveOffset: () => void;
  discardCurrentHistorySession: () => void;
  finalizeCurrentHistorySession: () => void;
  getContext: () => CanvasRenderingContext2D | null | undefined;
  resetInteractionRefs: () => void;
  resetSelectionState: () => void;
  session: SpriteEditorDocumentSession;
  syncCanvasSelectionSnapshot: (ctx: CanvasRenderingContext2D, rect: PixelRect | null) => void;
};
type SpriteEditorDocumentUi = {
  setDirty: (dirty: boolean) => void;
  setHoveredPixel: (point: { x: number; y: number } | null) => void;
  setIsActionsOpen: (open: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setLoadError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  setMoveOffset: (offset: { x: number; y: number }) => void;
  setSelectionRect: (rect: PixelRect | null) => void;
  setTool: (tool: 'move') => void;
};
type SpriteEditorHistoryUi = {
  setDirty: (dirty: boolean) => void;
  setRedoStack: SpriteHistoryStackSetter;
  setUndoStack: SpriteHistoryStackSetter;
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
  blob,
  controller,
  preferredPosition,
  ui,
}: {
  blob: Blob;
  controller: SpriteEditorDocumentController;
  preferredPosition: { x: number; y: number };
  ui: Pick<
    SpriteEditorDocumentUi,
    'setDirty' | 'setLoadError' | 'setMessage' | 'setMoveOffset' | 'setSelectionRect' | 'setTool'
  >;
}) {
  const ctx = controller.getContext();
  if (!ctx) {
    return;
  }

  controller.commitMoveOffset();
  const pasteResult = await pasteSelectionFromClipboard({
    beginDocumentHistorySession: controller.beginDocumentHistorySession,
    blob,
    ctx,
    preferredPosition,
  });
  if (!pasteResult.clippedImage || !pasteResult.pasteRect) {
    ui.setLoadError(pasteResult.error);
    return;
  }

  controller.syncCanvasSelectionSnapshot(ctx, null);
  controller.session.selectionPixels = pasteResult.clippedImage;
  controller.session.isSelectionCopy = true;
  controller.resetInteractionRefs();
  ui.setSelectionRect(pasteResult.pasteRect);
  ui.setMoveOffset({ x: 0, y: 0 });
  ui.setTool('move');
  ui.setDirty(true);
  ui.setLoadError(null);
  ui.setMessage('Pasted clipboard image.');
  controller.finalizeCurrentHistorySession();
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
  controller,
  direction,
  entry,
  ui,
}: {
  controller: Pick<
    SpriteEditorDocumentController,
    'discardCurrentHistorySession' | 'getContext' | 'resetSelectionState' | 'session'
  >;
  direction: 'undo' | 'redo';
  entry: SpriteHistoryEntry | undefined;
  ui: SpriteEditorHistoryUi;
}) {
  const ctx = controller.getContext();
  if (!ctx || !entry) {
    return;
  }

  controller.discardCurrentHistorySession();
  controller.session.moveSourceImageData = applyUndoRedoStep({ ctx, direction, entry });
  if (direction === 'undo') {
    ui.setUndoStack((current) => current.slice(0, -1));
    ui.setRedoStack((current) => [...current, entry].slice(-50));
  } else {
    ui.setRedoStack((current) => current.slice(0, -1));
    ui.setUndoStack((current) => [...current, entry].slice(-50));
  }
  controller.resetSelectionState();
  ui.setDirty(true);
}

export function runRevert({
  controller,
  dirty,
  originalImageData,
  ui,
}: {
  controller: Pick<
    SpriteEditorDocumentController,
    'discardCurrentHistorySession' | 'getContext' | 'resetSelectionState' | 'session'
  >;
  dirty: boolean;
  originalImageData: ImageData | null;
  ui: Pick<SpriteEditorDocumentUi, 'setDirty' | 'setMessage'> & {
    setRedoStack: (entries: []) => void;
    setUndoStack: (entries: []) => void;
  };
}) {
  const ctx = controller.getContext();
  if (!ctx || !originalImageData) {
    return;
  }
  if (dirty && !window.confirm('Revert all unsaved changes for this image?')) {
    return;
  }

  controller.session.moveSourceImageData = revertEditorDocument({ ctx, originalImageData });
  controller.discardCurrentHistorySession();
  ui.setUndoStack([]);
  ui.setRedoStack([]);
  ui.setDirty(false);
  controller.resetSelectionState();
  ui.setMessage('Reverted to the last saved image.');
}

export async function runSave({
  activeAsset,
  controller,
  isLoading,
  isSaving,
  moveOffset,
  selectionRect,
  ui,
}: {
  activeAsset: SpriteEditorAsset;
  controller: Pick<
    SpriteEditorDocumentController,
    | 'canvas'
    | 'cloneCanvasImage'
    | 'commitMoveOffset'
    | 'discardCurrentHistorySession'
    | 'resetInteractionRefs'
    | 'session'
    | 'syncCanvasSelectionSnapshot'
  >;
  isLoading: boolean;
  isSaving: boolean;
  moveOffset: { x: number; y: number };
  selectionRect: PixelRect | null;
  ui: Pick<
    SpriteEditorDocumentUi,
    'setDirty' | 'setIsSaving' | 'setLoadError' | 'setMessage' | 'setMoveOffset'
  >;
}) {
  const canvas = controller.canvas;
  if (!canvas || !activeAsset || isLoading || isSaving) {
    return;
  }
  if (moveOffset.x !== 0 || moveOffset.y !== 0) {
    controller.commitMoveOffset();
  }

  ui.setIsSaving(true);
  ui.setMessage(null);
  ui.setLoadError(null);
  try {
    const saveResult = await saveEditorDocument({
      assetPath: activeAsset.assetPath,
      canvas,
    });
    controller.session.originalImageData = saveResult.originalImageData ?? controller.cloneCanvasImage();
    const ctx = canvas.getContext('2d');
    if (ctx) {
      controller.syncCanvasSelectionSnapshot(ctx, selectionRect);
    }
    controller.discardCurrentHistorySession();
    ui.setDirty(false);
    controller.resetInteractionRefs();
    ui.setMoveOffset({ x: 0, y: 0 });
    ui.setMessage(`Saved ${activeAsset.fileName}.`);
  } catch (error) {
    ui.setLoadError(error instanceof Error ? error.message : 'Failed to save image.');
  } finally {
    ui.setIsSaving(false);
  }
}

export function runResizeCanvas({
  controller,
  moveOffset,
  ui,
}: {
  controller: Pick<
    SpriteEditorDocumentController,
    | 'beginDocumentHistorySession'
    | 'canvas'
    | 'commitMoveOffset'
    | 'finalizeCurrentHistorySession'
    | 'getContext'
    | 'resetSelectionState'
    | 'session'
  > & { centerCanvas: () => void };
  moveOffset: { x: number; y: number };
  ui: Pick<
    SpriteEditorDocumentUi,
    'setDirty' | 'setHoveredPixel' | 'setIsActionsOpen' | 'setLoadError' | 'setMessage'
  >;
}) {
  const canvas = controller.canvas;
  const ctx = controller.getContext();
  if (!canvas || !ctx) {
    return;
  }
  if (moveOffset.x !== 0 || moveOffset.y !== 0) {
    controller.commitMoveOffset();
  }

  const resizePrompt = promptResizeDimensions(canvas);
  if (resizePrompt.error) {
    ui.setLoadError(resizePrompt.error);
    return;
  }
  if (resizePrompt.message) {
    ui.setMessage(resizePrompt.message);
    return;
  }
  if (resizePrompt.nextWidth === null || resizePrompt.nextHeight === null) {
    return;
  }

  controller.beginDocumentHistorySession('Resize');
  controller.session.moveSourceImageData = resizeEditorDocument({
    ctx,
    nextHeight: resizePrompt.nextHeight,
    nextWidth: resizePrompt.nextWidth,
  });
  controller.session.selectionPixels = null;
  controller.session.isSelectionCopy = false;
  ui.setDirty(true);
  ui.setLoadError(null);
  ui.setHoveredPixel(null);
  controller.resetSelectionState();
  ui.setMessage(`Resized canvas to ${resizePrompt.nextWidth} x ${resizePrompt.nextHeight}.`);
  ui.setIsActionsOpen(false);
  controller.finalizeCurrentHistorySession();
  window.requestAnimationFrame(controller.centerCanvas);
}
