import { useEffect, type RefObject } from 'react';

import type { SpriteAssetEntry } from './assetCatalog';
import type { PendingSpriteHistorySession, SpriteHistoryEntry } from './documentCommands';
import { useSpriteEditorStore } from './state/spriteEditorStore';
import { cloneImageData } from './utils';

export function useSpriteAssetLoader({
  activeAsset,
  canvasRef,
  centerCanvas,
  discardCurrentHistorySession,
  resetSelectionState,
  session,
  setDirty,
  setHoveredPixel,
  setRedoStack,
  setUndoStack,
  syncCanvasSelectionSnapshot,
}: {
  activeAsset: SpriteAssetEntry | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  centerCanvas: () => void;
  discardCurrentHistorySession: () => void;
  resetSelectionState: () => void;
  session: {
    originalImageData: ImageData | null;
    pendingHistorySession: PendingSpriteHistorySession | null;
  };
  setDirty: (dirty: boolean) => void;
  setHoveredPixel: (point: { x: number; y: number } | null) => void;
  setRedoStack: (entries: SpriteHistoryEntry[]) => void;
  setUndoStack: (entries: SpriteHistoryEntry[]) => void;
  syncCanvasSelectionSnapshot: (ctx: CanvasRenderingContext2D, rect: null) => void;
}) {
  const handlers = useSpriteEditorStore((state) => state.handlers);

  useEffect(() => {
    if (!activeAsset) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;
    const image = new Image();

    handlers.setIsLoading(true);
    handlers.setLoadError(null);
    handlers.setMessage(null);

    image.onload = () => {
      if (cancelled) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0);

      session.originalImageData = cloneImageData(ctx);
      syncCanvasSelectionSnapshot(ctx, null);
      discardCurrentHistorySession();
      setUndoStack([]);
      setRedoStack([]);
      setDirty(false);
      resetSelectionState();
      setHoveredPixel(null);
      handlers.setInteractionMode('idle');
      handlers.setIsLoading(false);
      window.requestAnimationFrame(centerCanvas);
    };

    image.onerror = () => {
      if (cancelled) {
        return;
      }

      handlers.setLoadError(`Failed to load ${activeAsset.fileName}.`);
      handlers.setIsLoading(false);
    };

    image.src = activeAsset.url;

    return () => {
      cancelled = true;
    };
  }, [activeAsset]);
}
