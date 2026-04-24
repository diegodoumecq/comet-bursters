import { useEffect, useMemo, useRef, useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/components/Resizable';
import { Switch } from '@/ui/components/Switch';
import {
  getGridSourcesForSpriteAsset,
  spriteAssets,
  type SpriteAssetGridSource,
} from './assetCatalog';
import {
  normalizeGridSettings,
  useSpriteEditorStore,
  type PixelRect,
  type RgbaColor,
  type SpriteEditorTool as Tool,
} from './state/spriteEditorStore';

function componentToHex(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}

function rgbaToHex(color: RgbaColor): string {
  return `#${componentToHex(color.r)}${componentToHex(color.g)}${componentToHex(color.b)}`;
}

function parseHexColor(value: string): RgbaColor {
  const normalized = value.replace('#', '');
  const safeValue = normalized.length === 6 ? normalized : 'ffffff';
  return {
    r: Number.parseInt(safeValue.slice(0, 2), 16),
    g: Number.parseInt(safeValue.slice(2, 4), 16),
    b: Number.parseInt(safeValue.slice(4, 6), 16),
    a: 255,
  };
}

function clampAlpha(alpha: number): number {
  return Math.max(0, Math.min(255, alpha));
}

function clampBrushSize(size: number): number {
  return Math.max(1, Math.min(12, Math.round(size)));
}

function clampZoom(value: number): number {
  return Math.max(2, Math.min(48, Math.round(value)));
}

function cloneImageData(ctx: CanvasRenderingContext2D): ImageData {
  return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function getPixelCoordinates(
  canvas: HTMLCanvasElement,
  event: React.PointerEvent<HTMLElement>,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }

  const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return null;
  }

  return { x, y };
}

function getPixelColor(ctx: CanvasRenderingContext2D, x: number, y: number): RgbaColor {
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  return { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] };
}

function paintPoint(
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

function paintLine(
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

function drawImageDataAtOffset(
  ctx: CanvasRenderingContext2D,
  source: ImageData,
  offset: { x: number; y: number },
) {
  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = source.width;
  scratchCanvas.height = source.height;
  const scratchCtx = scratchCanvas.getContext('2d');
  if (!scratchCtx) {
    return;
  }

  scratchCtx.putImageData(source, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratchCanvas, offset.x, offset.y);
}

function normalizeSelectionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): PixelRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  return {
    x: left,
    y: top,
    width: Math.abs(end.x - start.x) + 1,
    height: Math.abs(end.y - start.y) + 1,
  };
}

function cropImageData(source: ImageData, rect: PixelRect): ImageData {
  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = source.width;
  scratchCanvas.height = source.height;
  const scratchCtx = scratchCanvas.getContext('2d');
  if (!scratchCtx) {
    return new ImageData(rect.width, rect.height);
  }

  scratchCtx.putImageData(source, 0, 0);
  return scratchCtx.getImageData(rect.x, rect.y, rect.width, rect.height);
}

function drawSelectionAtOffset(
  ctx: CanvasRenderingContext2D,
  source: ImageData,
  selectionRect: PixelRect,
  selectionPixels: ImageData,
  offset: { x: number; y: number },
) {
  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = source.width;
  scratchCanvas.height = source.height;
  const scratchCtx = scratchCanvas.getContext('2d');
  if (!scratchCtx) {
    return;
  }

  scratchCtx.putImageData(source, 0, 0);
  scratchCtx.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);

  const selectionCanvas = document.createElement('canvas');
  selectionCanvas.width = selectionPixels.width;
  selectionCanvas.height = selectionPixels.height;
  const selectionCtx = selectionCanvas.getContext('2d');
  if (!selectionCtx) {
    return;
  }

  selectionCtx.putImageData(selectionPixels, 0, 0);
  scratchCtx.imageSmoothingEnabled = false;
  scratchCtx.drawImage(selectionCanvas, selectionRect.x + offset.x, selectionRect.y + offset.y);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratchCanvas, 0, 0);
}

export function SpriteEditorApp() {
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const selectionDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const moveDragOriginRef = useRef<{
    startOffsetX: number;
    startOffsetY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const moveSourceImageDataRef = useRef<ImageData | null>(null);
  const selectionPixelsRef = useRef<ImageData | null>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const panOriginRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isAssetsSectionOpen, setIsAssetsSectionOpen] = useState(true);
  const [isGridSectionOpen, setIsGridSectionOpen] = useState(true);
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
  const activeAssetPath = useSpriteEditorStore((state) => state.activeAssetPath);
  const brushColor = useSpriteEditorStore((state) => state.brushColor);
  const brushSize = useSpriteEditorStore((state) => state.brushSize);
  const gridColor = useSpriteEditorStore((state) => state.gridColor);
  const gridOpacity = useSpriteEditorStore((state) => state.gridOpacity);
  const gridSettings = useSpriteEditorStore((state) => state.gridSettings);
  const hoveredPixel = useSpriteEditorStore((state) => state.hoveredPixel);
  const interactionMode = useSpriteEditorStore((state) => state.interactionMode);
  const isActionsOpen = useSpriteEditorStore((state) => state.isActionsOpen);
  const isGridVisible = useSpriteEditorStore((state) => state.isGridVisible);
  const isLoading = useSpriteEditorStore((state) => state.isLoading);
  const isSaving = useSpriteEditorStore((state) => state.isSaving);
  const isSidebarResizable = useSpriteEditorStore((state) => state.isSidebarResizable);
  const isSpacePressed = useSpriteEditorStore((state) => state.isSpacePressed);
  const loadError = useSpriteEditorStore((state) => state.loadError);
  const message = useSpriteEditorStore((state) => state.message);
  const selectionRect = useSpriteEditorStore((state) => state.selectionRect);
  const sidebarSize = useSpriteEditorStore((state) => state.sidebarSize);
  const tool = useSpriteEditorStore((state) => state.tool);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const viewportOffset = useSpriteEditorStore((state) => state.viewportOffset);
  const zoom = useSpriteEditorStore((state) => state.zoom);
  const applyGridSettings = useSpriteEditorStore((state) => state.applyGridSettings);
  const resetGridSettings = useSpriteEditorStore((state) => state.resetGridSettings);
  const setActiveAssetPath = useSpriteEditorStore((state) => state.setActiveAssetPath);
  const setBrushColor = useSpriteEditorStore((state) => state.setBrushColor);
  const setBrushSize = useSpriteEditorStore((state) => state.setBrushSize);
  const setGridColor = useSpriteEditorStore((state) => state.setGridColor);
  const setGridOpacity = useSpriteEditorStore((state) => state.setGridOpacity);
  const setHoveredPixel = useSpriteEditorStore((state) => state.setHoveredPixel);
  const setInteractionMode = useSpriteEditorStore((state) => state.setInteractionMode);
  const setIsActionsOpen = useSpriteEditorStore((state) => state.setIsActionsOpen);
  const setIsGridVisible = useSpriteEditorStore((state) => state.setIsGridVisible);
  const setIsLoading = useSpriteEditorStore((state) => state.setIsLoading);
  const setIsSidebarResizable = useSpriteEditorStore((state) => state.setIsSidebarResizable);
  const setIsSaving = useSpriteEditorStore((state) => state.setIsSaving);
  const setIsSpacePressed = useSpriteEditorStore((state) => state.setIsSpacePressed);
  const setLoadError = useSpriteEditorStore((state) => state.setLoadError);
  const setMessage = useSpriteEditorStore((state) => state.setMessage);
  const setSelectionRect = useSpriteEditorStore((state) => state.setSelectionRect);
  const setSidebarSize = useSpriteEditorStore((state) => state.setSidebarSize);
  const setTool = useSpriteEditorStore((state) => state.setTool);
  const setViewportOffset = useSpriteEditorStore((state) => state.setViewportOffset);
  const setZoom = useSpriteEditorStore((state) => state.setZoom);
  const updateGridNumber = useSpriteEditorStore((state) => state.updateGridNumber);

  const activeAsset = useMemo(
    () => spriteAssets.find((asset) => asset.assetPath === activeAssetPath) ?? null,
    [activeAssetPath],
  );
  const matchingGridSources = useMemo(
    () => (activeAssetPath ? getGridSourcesForSpriteAsset(activeAssetPath) : []),
    [activeAssetPath],
  );
  const assetsByCategory = useMemo(() => {
    return spriteAssets.reduce(
      (groups, asset) => {
        groups[asset.category] = [...(groups[asset.category] ?? []), asset];
        return groups;
      },
      {} as Record<string, typeof spriteAssets>,
    );
  }, []);

  const centerCanvasInViewport = (nextZoom = zoom) => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) {
      return;
    }

    setViewportOffset({
      x: Math.round((viewport.clientWidth - canvas.width * nextZoom) / 2),
      y: Math.round((viewport.clientHeight - canvas.height * nextZoom) / 2),
    });
  };

  const applyZoom = (nextZoomValue: number, focusPoint?: { clientX: number; clientY: number }) => {
    const nextZoom = clampZoom(nextZoomValue);
    if (nextZoom === zoom) {
      return;
    }

    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) {
      setZoom(nextZoom);
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const focusX = focusPoint ? focusPoint.clientX - rect.left : viewport.clientWidth / 2;
    const focusY = focusPoint ? focusPoint.clientY - rect.top : viewport.clientHeight / 2;
    const worldX = (focusX - viewportOffset.x) / zoom;
    const worldY = (focusY - viewportOffset.y) / zoom;

    setZoom(nextZoom);
    setViewportOffset({
      x: Math.round(focusX - worldX * nextZoom),
      y: Math.round(focusY - worldY * nextZoom),
    });
  };

  const applyGridSource = (
    source: SpriteAssetGridSource,
    options?: { announce?: boolean; makeVisible?: boolean },
  ) => {
    applyGridSettings(normalizeGridSettings(source.grid));
    if (options?.makeVisible ?? true) {
      setIsGridVisible(true);
    }
    if (options?.announce ?? true) {
      setMessage(`Loaded grid from ${source.id}.`);
    }
    setLoadError(null);
  };

  const commitMoveOffset = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    if (moveOffset.x === 0 && moveOffset.y === 0) {
      moveSourceImageDataRef.current = cloneImageData(ctx);
      if (selectionRect) {
        selectionPixelsRef.current = cropImageData(cloneImageData(ctx), selectionRect);
      }
      return;
    }

    const committedImage = cloneImageData(ctx);
    moveSourceImageDataRef.current = committedImage;
    if (selectionRect) {
      const nextSelectionRect = {
        ...selectionRect,
        x: selectionRect.x + moveOffset.x,
        y: selectionRect.y + moveOffset.y,
      };
      setSelectionRect(nextSelectionRect);
      selectionPixelsRef.current = cropImageData(committedImage, nextSelectionRect);
    }
    setMoveOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeAsset) {
      return;
    }

    let cancelled = false;
    const image = new Image();
    setIsLoading(true);
    setLoadError(null);
    setMessage(null);
    image.onload = () => {
      if (cancelled || !canvas) {
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
      originalImageDataRef.current = cloneImageData(ctx);
      moveSourceImageDataRef.current = cloneImageData(ctx);
      selectionPixelsRef.current = null;
      selectionDragOriginRef.current = null;
      moveDragOriginRef.current = null;
      setUndoStack([]);
      setRedoStack([]);
      setDirty(false);
      setMoveOffset({ x: 0, y: 0 });
      setSelectionRect(null);
      setHoveredPixel(null);
      setInteractionMode('idle');
      setIsLoading(false);
      window.requestAnimationFrame(() => {
        centerCanvasInViewport(zoom);
      });
    };
    image.onerror = () => {
      if (cancelled) {
        return;
      }
      setLoadError(`Failed to load ${activeAsset.fileName}.`);
      setIsLoading(false);
    };
    image.src = activeAsset.url;

    return () => {
      cancelled = true;
    };
  }, [activeAsset]);

  useEffect(() => {
    if (matchingGridSources.length > 0) {
      applyGridSource(matchingGridSources[0], { announce: false, makeVisible: false });
      return;
    }

    resetGridSettings();
  }, [matchingGridSources, applyGridSettings, resetGridSettings]);

  useEffect(() => {
    if (!isActionsOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!actionsMenuRef.current?.contains(event.target as Node)) {
        setIsActionsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isActionsOpen]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const handleNativeWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };

    viewport.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  const commitSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    setUndoStack((current) => [...current, cloneImageData(ctx)].slice(-50));
    setRedoStack([]);
  };

  const handleSelectAsset = (nextAssetPath: string) => {
    if (nextAssetPath === activeAssetPath) {
      return;
    }
    if (dirty && !window.confirm('Discard unsaved sprite changes?')) {
      return;
    }

    setActiveAssetPath(nextAssetPath);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || undoStack.length === 0) {
      return;
    }

    const currentSnapshot = cloneImageData(ctx);
    const nextUndoStack = undoStack.slice(0, -1);
    const snapshot = undoStack[undoStack.length - 1];
    ctx.putImageData(snapshot, 0, 0);
    setUndoStack(nextUndoStack);
    setRedoStack((current) => [...current, currentSnapshot].slice(-50));
    moveSourceImageDataRef.current = cloneImageData(ctx);
    selectionPixelsRef.current = selectionRect
      ? cropImageData(cloneImageData(ctx), selectionRect)
      : null;
    selectionDragOriginRef.current = null;
    moveDragOriginRef.current = null;
    setMoveOffset({ x: 0, y: 0 });
    setSelectionRect(null);
    setDirty(true);
  };

  const handleRedo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || redoStack.length === 0) {
      return;
    }

    const currentSnapshot = cloneImageData(ctx);
    const nextRedoStack = redoStack.slice(0, -1);
    const snapshot = redoStack[redoStack.length - 1];
    ctx.putImageData(snapshot, 0, 0);
    setRedoStack(nextRedoStack);
    setUndoStack((current) => [...current, currentSnapshot].slice(-50));
    moveSourceImageDataRef.current = cloneImageData(ctx);
    selectionPixelsRef.current = selectionRect
      ? cropImageData(cloneImageData(ctx), selectionRect)
      : null;
    selectionDragOriginRef.current = null;
    moveDragOriginRef.current = null;
    setMoveOffset({ x: 0, y: 0 });
    setSelectionRect(null);
    setDirty(true);
  };

  const handleRevert = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const originalImageData = originalImageDataRef.current;
    if (!canvas || !ctx || !originalImageData) {
      return;
    }

    if (dirty && !window.confirm('Revert all unsaved changes for this image?')) {
      return;
    }

    ctx.putImageData(originalImageData, 0, 0);
    moveSourceImageDataRef.current = cloneImageData(ctx);
    selectionPixelsRef.current = null;
    selectionDragOriginRef.current = null;
    moveDragOriginRef.current = null;
    setUndoStack([]);
    setRedoStack([]);
    setDirty(false);
    setMoveOffset({ x: 0, y: 0 });
    setSelectionRect(null);
    setMessage('Reverted to the last saved image.');
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
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
      const pngDataUrl = canvas.toDataURL('image/png');
      const response = await fetch('/__editor/save-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetPath: activeAsset.assetPath,
          pngDataUrl,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error ?? 'Failed to save image');
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        originalImageDataRef.current = cloneImageData(ctx);
        moveSourceImageDataRef.current = cloneImageData(ctx);
        selectionPixelsRef.current = selectionRect
          ? cropImageData(cloneImageData(ctx), selectionRect)
          : null;
      }
      setDirty(false);
      selectionDragOriginRef.current = null;
      moveDragOriginRef.current = null;
      setMoveOffset({ x: 0, y: 0 });
      setMessage(`Saved ${activeAsset.fileName}.`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to save image.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResizeCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    if (moveOffset.x !== 0 || moveOffset.y !== 0) {
      commitMoveOffset();
    }

    const widthInput = window.prompt('New canvas width in pixels', String(canvas.width));
    if (widthInput === null) {
      return;
    }

    const nextWidth = Number.parseInt(widthInput, 10);
    if (!Number.isFinite(nextWidth) || nextWidth < 1) {
      setLoadError('Canvas width must be a positive integer.');
      return;
    }

    const heightInput = window.prompt('New canvas height in pixels', String(canvas.height));
    if (heightInput === null) {
      return;
    }

    const nextHeight = Number.parseInt(heightInput, 10);
    if (!Number.isFinite(nextHeight) || nextHeight < 1) {
      setLoadError('Canvas height must be a positive integer.');
      return;
    }

    if (nextWidth === canvas.width && nextHeight === canvas.height) {
      setMessage('Canvas size unchanged.');
      return;
    }

    const previousSnapshot = cloneImageData(ctx);
    const resizeSource = document.createElement('canvas');
    resizeSource.width = canvas.width;
    resizeSource.height = canvas.height;
    resizeSource.getContext('2d')?.putImageData(previousSnapshot, 0, 0);

    commitSnapshot();
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, nextWidth, nextHeight);
    ctx.drawImage(resizeSource, 0, 0);
    moveSourceImageDataRef.current = cloneImageData(ctx);
    selectionPixelsRef.current = null;
    selectionDragOriginRef.current = null;
    moveDragOriginRef.current = null;
    setDirty(true);
    setLoadError(null);
    setHoveredPixel(null);
    setMoveOffset({ x: 0, y: 0 });
    setSelectionRect(null);
    setMessage(`Resized canvas to ${nextWidth} x ${nextHeight}.`);
    setIsActionsOpen(false);
    window.requestAnimationFrame(() => {
      centerCanvasInViewport(zoom);
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (event.code === 'Space' && !isEditingField) {
        event.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      if (isEditingField) {
        return;
      }

      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 's') {
        event.preventDefault();
        void handleSave();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (key === '+' || key === '=')) {
        event.preventDefault();
        applyZoom(zoom + 2);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === '-') {
        event.preventDefault();
        applyZoom(zoom - 2);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
          return;
        }
        handleUndo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'y') {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (key === 'b') {
        setTool('draw');
        return;
      }
      if (key === 'v') {
        setTool('move');
        return;
      }
      if (key === 'm') {
        setTool('select');
        return;
      }
      if (key === 'e') {
        setTool('erase');
        return;
      }
      if (key === 'i') {
        setTool('picker');
        return;
      }
      if (event.key === '[') {
        event.preventDefault();
        setBrushSize((current) => clampBrushSize(current - 1));
        return;
      }
      if (event.key === ']') {
        event.preventDefault();
        setBrushSize((current) => clampBrushSize(current + 1));
        return;
      }
      if (key === '0') {
        event.preventDefault();
        centerCanvasInViewport(zoom);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleRedo, handleSave, handleUndo, zoom]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const shouldPan = event.button === 1 || (event.button === 0 && isSpacePressed);
    if (shouldPan) {
      event.preventDefault();
      panOriginRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: viewportOffset.x,
        startOffsetY: viewportOffset.y,
      };
      setInteractionMode('pan');
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    const point = getPixelCoordinates(canvas, event);
    if (!point) {
      return;
    }

    const activeTool = event.altKey ? 'picker' : tool;
    if (activeTool === 'select') {
      if (moveOffset.x !== 0 || moveOffset.y !== 0) {
        commitMoveOffset();
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      selectionDragOriginRef.current = point;
      setSelectionRect({ x: point.x, y: point.y, width: 1, height: 1 });
      setInteractionMode('select');
      return;
    }

    if (activeTool === 'move') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      if (moveSourceImageDataRef.current === null) {
        moveSourceImageDataRef.current = cloneImageData(ctx);
      }
      if (selectionRect && !selectionPixelsRef.current) {
        selectionPixelsRef.current = cropImageData(moveSourceImageDataRef.current, selectionRect);
      }
      if (moveOffset.x === 0 && moveOffset.y === 0) {
        commitSnapshot();
      }
      moveDragOriginRef.current = {
        startOffsetX: moveOffset.x,
        startOffsetY: moveOffset.y,
        startX: point.x,
        startY: point.y,
      };
      setInteractionMode('move');
      return;
    }

    if (activeTool === 'picker') {
      setBrushColor(getPixelColor(ctx, point.x, point.y));
      return;
    }

    if (moveOffset.x !== 0 || moveOffset.y !== 0) {
      commitMoveOffset();
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    commitSnapshot();
    paintPoint(ctx, point.x, point.y, brushSize, activeTool, brushColor);
    lastPointerRef.current = point;
    setInteractionMode('paint');
    setDirty(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    const point = getPixelCoordinates(canvas, event);
    setHoveredPixel(point);

    if (interactionMode === 'pan') {
      const panOrigin = panOriginRef.current;
      if (!panOrigin) {
        return;
      }
      setViewportOffset({
        x: panOrigin.startOffsetX + (event.clientX - panOrigin.startClientX),
        y: panOrigin.startOffsetY + (event.clientY - panOrigin.startClientY),
      });
      return;
    }

    if (interactionMode === 'select') {
      const selectionOrigin = selectionDragOriginRef.current;
      if (!selectionOrigin || !point) {
        return;
      }

      setSelectionRect(normalizeSelectionRect(selectionOrigin, point));
      return;
    }

    if (interactionMode === 'move') {
      const moveOrigin = moveDragOriginRef.current;
      const moveSource = moveSourceImageDataRef.current;
      if (!moveOrigin || !moveSource || !point) {
        return;
      }

      const nextOffset = {
        x: moveOrigin.startOffsetX + (point.x - moveOrigin.startX),
        y: moveOrigin.startOffsetY + (point.y - moveOrigin.startY),
      };
      if (selectionRect && selectionPixelsRef.current) {
        drawSelectionAtOffset(
          ctx,
          moveSource,
          selectionRect,
          selectionPixelsRef.current,
          nextOffset,
        );
      } else {
        drawImageDataAtOffset(ctx, moveSource, nextOffset);
      }
      setMoveOffset(nextOffset);
      setDirty(true);
      return;
    }

    if ((event.buttons & 1) !== 1 || interactionMode !== 'paint') {
      return;
    }

    const previousPoint = lastPointerRef.current;
    if (!point || !previousPoint) {
      return;
    }

    paintLine(ctx, previousPoint, point, brushSize, tool, brushColor);
    lastPointerRef.current = point;
    setDirty(true);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const completedSelectionRect = selectionRect;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panOriginRef.current = null;
    selectionDragOriginRef.current = null;
    moveDragOriginRef.current = null;
    lastPointerRef.current = null;
    if (interactionMode === 'select' && completedSelectionRect && moveSourceImageDataRef.current) {
      selectionPixelsRef.current = cropImageData(
        moveSourceImageDataRef.current,
        completedSelectionRect,
      );
    }
    setInteractionMode('idle');
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const direction = event.deltaY < 0 ? 1 : -1;
      const step = event.shiftKey ? 4 : 2;
      applyZoom(zoom + direction * step, { clientX: event.clientX, clientY: event.clientY });
      return;
    }

    setViewportOffset((current) => ({
      x: current.x - Math.round(event.deltaX),
      y: current.y - Math.round(event.deltaY),
    }));
  };

  const activeHexColor = rgbaToHex(brushColor);
  const canvasSizeLabel = canvasRef.current
    ? `${canvasRef.current.width} x ${canvasRef.current.height}`
    : '—';
  const canvasCursor =
    interactionMode === 'pan'
      ? 'grabbing'
      : isSpacePressed
        ? 'grab'
        : tool === 'move'
          ? 'move'
          : tool === 'picker'
            ? 'cell'
            : 'crosshair';
  const brushPreviewSize = brushSize * zoom;
  const brushPreviewLeft =
    hoveredPixel && activeAsset
      ? viewportOffset.x + (hoveredPixel.x - Math.floor(brushSize / 2)) * zoom
      : 0;
  const brushPreviewTop =
    hoveredPixel && activeAsset
      ? viewportOffset.y + (hoveredPixel.y - Math.floor(brushSize / 2)) * zoom
      : 0;
  const shouldShowBrushPreview = hoveredPixel && activeAsset && interactionMode !== 'pan';
  const gridStepX = gridSettings.frameWidth + (gridSettings.gapX ?? 0);
  const gridStepY = gridSettings.frameHeight + (gridSettings.gapY ?? 0);
  const gridColorWithAlpha = `${gridColor}${Math.round(gridOpacity * 255)
    .toString(16)
    .padStart(2, '0')}`;
  const scaledGridStepX = Math.round(gridStepX * zoom);
  const scaledGridStepY = Math.round(gridStepY * zoom);
  const scaledGridOffsetX = Math.round((gridSettings.offsetX ?? 0) * zoom);
  const scaledGridOffsetY = Math.round((gridSettings.offsetY ?? 0) * zoom);
  const scaledCanvasWidth = canvasRef.current ? Math.round(canvasRef.current.width * zoom) : 0;
  const scaledCanvasHeight = canvasRef.current ? Math.round(canvasRef.current.height * zoom) : 0;
  const shouldShowGridOverlay =
    isGridVisible && activeAsset && gridSettings.frameWidth > 0 && gridSettings.frameHeight > 0;
  const verticalGridLines =
    shouldShowGridOverlay && scaledGridStepX > 0
      ? Array.from(
          {
            length:
              Math.floor(Math.max(scaledCanvasWidth - scaledGridOffsetX, 0) / scaledGridStepX) + 1,
          },
          (_, index) => scaledGridOffsetX + index * scaledGridStepX,
        ).filter((position) => position >= 0 && position <= scaledCanvasWidth)
      : [];
  const horizontalGridLines =
    shouldShowGridOverlay && scaledGridStepY > 0
      ? Array.from(
          {
            length:
              Math.floor(Math.max(scaledCanvasHeight - scaledGridOffsetY, 0) / scaledGridStepY) + 1,
          },
          (_, index) => scaledGridOffsetY + index * scaledGridStepY,
        ).filter((position) => position >= 0 && position <= scaledCanvasHeight)
      : [];
  const displayedSelectionRect =
    selectionRect !== null
      ? {
          ...selectionRect,
          x: selectionRect.x + moveOffset.x,
          y: selectionRect.y + moveOffset.y,
        }
      : null;
  const selectionOverlayStyle = displayedSelectionRect
    ? {
        height: `${displayedSelectionRect.height * zoom}px`,
        left: `${viewportOffset.x + displayedSelectionRect.x * zoom}px`,
        top: `${viewportOffset.y + displayedSelectionRect.y * zoom}px`,
        width: `${displayedSelectionRect.width * zoom}px`,
      }
    : null;

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      id="sprite-editor-layout"
      onLayoutChanged={(layout) => {
        const nextSidebarSize = layout['sprite-editor-sidebar'];
        if (typeof nextSidebarSize === 'number' && Number.isFinite(nextSidebarSize)) {
          setSidebarSize(nextSidebarSize);
        }
      }}
      className="h-screen overflow-hidden bg-slate-950 text-slate-100"
    >
      <ResizablePanel
        id="sprite-editor-sidebar"
        defaultSize={`${sidebarSize}%`}
        minSize="10%"
        maxSize="80%"
        className="flex h-full min-w-0 flex-col border-r border-slate-800 bg-slate-950/95"
      >
        <div className="border-b border-slate-800 px-6 py-5">
          <a
            href="/"
            className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Back Home
          </a>
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Assets
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white">Sprite Editor</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Pick a PNG from `src/assets`, paint directly on the sprite, and save it back to disk.
          </p>
          <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
            <span>Resizable Sidebar</span>
            <Switch checked={isSidebarResizable} onCheckedChange={setIsSidebarResizable} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            <CollapsibleSection
              title={`Grid`}
              isOpen={isGridSectionOpen}
              onToggle={() => setIsGridSectionOpen((current) => !current)}
            >
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-300">Overlay and tileset frame settings</div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>Show</span>
                    <Switch checked={isGridVisible} onCheckedChange={setIsGridVisible} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                    <span className="min-w-16 uppercase tracking-[0.16em] text-slate-500">
                      Color
                    </span>
                    <input
                      type="color"
                      value={gridColor}
                      onChange={(event) => setGridColor(event.currentTarget.value)}
                      className="h-8 w-8 rounded border-0 bg-transparent p-0"
                    />
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={gridOpacity}
                      onChange={(event) => setGridOpacity(Number(event.currentTarget.value))}
                      className="flex-1"
                    />
                    <span className="w-10 text-right text-slate-100">
                      {Math.round(gridOpacity * 100)}%
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Frame Width</div>
                      <input
                        type="number"
                        min="1"
                        value={gridSettings.frameWidth}
                        onChange={(event) =>
                          updateGridNumber('frameWidth', event.currentTarget.value, true)
                        }
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Frame Height</div>
                      <input
                        type="number"
                        min="1"
                        value={gridSettings.frameHeight}
                        onChange={(event) =>
                          updateGridNumber('frameHeight', event.currentTarget.value, true)
                        }
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Offset X</div>
                      <input
                        type="number"
                        min="0"
                        value={gridSettings.offsetX ?? ''}
                        onChange={(event) => updateGridNumber('offsetX', event.currentTarget.value)}
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Offset Y</div>
                      <input
                        type="number"
                        min="0"
                        value={gridSettings.offsetY ?? ''}
                        onChange={(event) => updateGridNumber('offsetY', event.currentTarget.value)}
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Gap X</div>
                      <input
                        type="number"
                        min="0"
                        value={gridSettings.gapX ?? ''}
                        onChange={(event) => updateGridNumber('gapX', event.currentTarget.value)}
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Gap Y</div>
                      <input
                        type="number"
                        min="0"
                        value={gridSettings.gapY ?? ''}
                        onChange={(event) => updateGridNumber('gapY', event.currentTarget.value)}
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Columns</div>
                      <input
                        type="number"
                        min="0"
                        value={gridSettings.columns ?? ''}
                        onChange={(event) => updateGridNumber('columns', event.currentTarget.value)}
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Rows</div>
                      <input
                        type="number"
                        min="0"
                        value={gridSettings.rows ?? ''}
                        onChange={(event) => updateGridNumber('rows', event.currentTarget.value)}
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="col-span-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                      <div className="uppercase tracking-[0.16em] text-slate-500">Frame Count</div>
                      <input
                        type="number"
                        min="0"
                        value={gridSettings.frameCount ?? ''}
                        onChange={(event) =>
                          updateGridNumber('frameCount', event.currentTarget.value)
                        }
                        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      Tileset Presets
                    </div>
                    {matchingGridSources.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {matchingGridSources.map((source) => (
                          <button
                            key={`${source.sourcePath}:${source.id}`}
                            type="button"
                            onClick={() => applyGridSource(source)}
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-left transition hover:border-slate-600"
                          >
                            <div className="text-sm text-slate-100">{source.id}</div>
                            <div className="mt-1 text-xs text-slate-500">{source.sourcePath}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-slate-500">
                        No matching `.tileset.json` found for this image.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title={`Assets (${spriteAssets.length})`}
              isOpen={isAssetsSectionOpen}
              onToggle={() => setIsAssetsSectionOpen((current) => !current)}
            >
              <div className="space-y-5">
                {Object.entries(assetsByCategory).map(([category, assets]) => (
                  <section key={category}>
                    <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {category}
                    </div>
                    <div className="space-y-2">
                      {assets.map((asset) => (
                        <button
                          key={asset.assetPath}
                          type="button"
                          onClick={() => handleSelectAsset(asset.assetPath)}
                          className={`grid w-full grid-cols-[3rem_1fr] gap-3 rounded-2xl border p-3 text-left transition ${
                            asset.assetPath === activeAssetPath
                              ? 'border-cyan-300 bg-cyan-500/15'
                              : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                            <img
                              src={asset.url}
                              alt={asset.fileName}
                              className="max-h-full max-w-full object-contain"
                              style={{ imageRendering: 'pixelated' }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-100">
                              {asset.fileName}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500">
                              {asset.assetPath}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle disabled={!isSidebarResizable} withHandle={isSidebarResizable} />

      <ResizablePanel
        id="sprite-editor-main"
        defaultSize={`${100 - sidebarSize}%`}
        minSize="40%"
        className="min-w-0"
      >
        <main className="h-full min-w-0 overflow-hidden bg-slate-950 p-8">
          <div className="flex h-full min-h-0 w-full flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Editing
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {activeAsset?.assetPath ?? 'No asset selected'}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {dirty ? 'Unsaved changes' : 'Saved'}
                  {isLoading ? ' • Loading…' : null}
                  {isSaving ? ' • Saving…' : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div ref={actionsMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsActionsOpen((current) => !current)}
                    className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
                  >
                    Actions
                  </button>
                  {isActionsOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-52 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-slate-950/60">
                      <button
                        type="button"
                        onClick={handleResizeCanvas}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-900/90"
                      >
                        <span>Resize canvas…</span>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          {canvasSizeLabel}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:opacity-40"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:opacity-40"
                >
                  Redo
                </button>
                <button
                  type="button"
                  onClick={handleRevert}
                  disabled={!dirty}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:opacity-40"
                >
                  Revert
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!activeAsset || isLoading || isSaving || !dirty}
                  className="rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-300 disabled:opacity-40"
                >
                  Save PNG
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 xl:grid-cols-[auto_auto_auto_1fr]">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['draw', 'Brush', 'B'],
                    ['move', 'Move', 'V'],
                    ['select', 'Select', 'M'],
                    ['erase', 'Erase', 'E'],
                    ['picker', 'Pick', 'I'],
                  ] as const
                ).map(([nextTool, label, shortcut]) => (
                  <button
                    key={nextTool}
                    type="button"
                    onClick={() => setTool(nextTool)}
                    className={`rounded-2xl border px-3 py-2 text-left transition ${
                      tool === nextTool
                        ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      {shortcut}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <label className="flex items-center gap-3 text-xs text-slate-300">
                  <span className="uppercase tracking-[0.18em] text-slate-500">Color</span>
                  <input
                    type="color"
                    value={activeHexColor}
                    onChange={(event) => {
                      const nextColor = parseHexColor(event.currentTarget.value);
                      setBrushColor((current) => ({ ...nextColor, a: current.a }));
                    }}
                    className="h-10 w-10 rounded-lg border-0 bg-transparent p-0"
                  />
                </label>
                <div
                  className="h-10 w-10 rounded-xl border border-white/15"
                  style={{
                    backgroundColor: `rgba(${brushColor.r}, ${brushColor.g}, ${brushColor.b}, ${
                      brushColor.a / 255
                    })`,
                  }}
                />
                <div className="text-sm text-slate-300">
                  <div>{rgbaToHex(brushColor).toUpperCase()}</div>
                  <div className="text-xs text-slate-500">
                    rgba({brushColor.r}, {brushColor.g}, {brushColor.b},{' '}
                    {(brushColor.a / 255).toFixed(2)})
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-w-[15rem] items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
                  <span className="uppercase tracking-[0.18em] text-slate-500">Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={brushColor.a}
                    onChange={(event) => {
                      const nextAlpha = clampAlpha(Number(event.currentTarget.value));
                      setBrushColor((current) => ({
                        ...current,
                        a: nextAlpha,
                      }));
                    }}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-sm text-slate-100">
                    {Math.round((brushColor.a / 255) * 100)}%
                  </span>
                </label>

                <label className="flex min-w-[15rem] items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
                  <span className="uppercase tracking-[0.18em] text-slate-500">Brush</span>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={brushSize}
                    onChange={(event) =>
                      setBrushSize(clampBrushSize(Number(event.currentTarget.value)))
                    }
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-sm text-slate-100">{brushSize}px</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                <div className="mr-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                  Zoom
                </div>
                {[4, 8, 16, 24, 32].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyZoom(preset)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      zoom === preset
                        ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {preset}x
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => centerCanvasInViewport(zoom)}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600"
                >
                  Center
                </button>
              </div>
            </div>

            {message || loadError ? (
              <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm">
                {message ? <div className="text-emerald-300">{message}</div> : null}
                {loadError ? <div className="text-rose-300">{loadError}</div> : null}
              </div>
            ) : null}

            <div
              ref={viewportRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={() => {
                if (interactionMode === 'idle') {
                  setHoveredPixel(null);
                }
              }}
              onWheel={handleWheel}
              onContextMenu={(event) => event.preventDefault()}
              className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950"
              style={{
                backgroundColor: '#020617',
                backgroundImage:
                  'linear-gradient(45deg, rgba(148,163,184,0.12) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.12) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.12) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.12) 75%)',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
                backgroundSize: '16px 16px',
                cursor: canvasCursor,
                touchAction: 'none',
              }}
            >
              {activeAsset ? (
                <>
                  <canvas
                    ref={canvasRef}
                    className="absolute left-0 top-0 block shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                    style={{
                      height: canvasRef.current ? `${canvasRef.current.height}px` : undefined,
                      imageRendering: 'pixelated',
                      transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${zoom})`,
                      transformOrigin: 'top left',
                      width: canvasRef.current ? `${canvasRef.current.width}px` : undefined,
                    }}
                  />
                  {shouldShowGridOverlay ? (
                    <div
                      className="pointer-events-none absolute"
                      style={{
                        height: `${scaledCanvasHeight}px`,
                        left: `${viewportOffset.x}px`,
                        top: `${viewportOffset.y}px`,
                        width: `${scaledCanvasWidth}px`,
                      }}
                    >
                      {verticalGridLines.map((position) => (
                        <div
                          key={`grid-v-${position}`}
                          className="absolute top-0"
                          style={{
                            backgroundColor: gridColorWithAlpha,
                            height: `${scaledCanvasHeight}px`,
                            left: `${position}px`,
                            width: '1px',
                          }}
                        />
                      ))}
                      {horizontalGridLines.map((position) => (
                        <div
                          key={`grid-h-${position}`}
                          className="absolute left-0"
                          style={{
                            backgroundColor: gridColorWithAlpha,
                            height: '1px',
                            top: `${position}px`,
                            width: `${scaledCanvasWidth}px`,
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {selectionOverlayStyle ? (
                    <div
                      className="pointer-events-none absolute border border-cyan-300"
                      style={{
                        ...selectionOverlayStyle,
                        boxShadow: '0 0 0 1px rgba(8,145,178,0.45)',
                      }}
                    >
                      <div className="h-full w-full border border-dashed border-white/80" />
                    </div>
                  ) : null}
                  {shouldShowBrushPreview ? (
                    <div
                      className="pointer-events-none absolute border"
                      style={{
                        backgroundColor:
                          tool === 'erase'
                            ? 'rgba(248, 113, 113, 0.18)'
                            : `rgba(${brushColor.r}, ${brushColor.g}, ${brushColor.b}, ${Math.max(
                                0.12,
                                (brushColor.a / 255) * 0.35,
                              )})`,
                        borderColor:
                          tool === 'erase'
                            ? 'rgba(248, 113, 113, 0.9)'
                            : 'rgba(255, 255, 255, 0.9)',
                        boxSizing: 'border-box',
                        height: `${brushPreviewSize}px`,
                        left: `${brushPreviewLeft}px`,
                        top: `${brushPreviewTop}px`,
                        width: `${brushPreviewSize}px`,
                      }}
                    />
                  ) : null}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No asset selected.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              <div className="flex flex-wrap items-center gap-4">
                <div>Canvas {canvasSizeLabel}</div>
                <div>Tool {tool}</div>
                <div>Brush {brushSize}px</div>
                <div>Zoom {zoom}x</div>
                <div>
                  Selection{' '}
                  {displayedSelectionRect
                    ? `${displayedSelectionRect.width} x ${displayedSelectionRect.height}`
                    : '—'}
                </div>
                <div>Cursor {hoveredPixel ? `${hoveredPixel.x}, ${hoveredPixel.y}` : '—'}</div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.16em] text-slate-500">
                <span>`Alt` pick</span>
                <span>`Space` drag</span>
                <span>`V` move</span>
                <span>`M` select</span>
                <span>`Wheel` pan</span>
                <span>`Cmd/Ctrl+Wheel` zoom</span>
                <span>`[` `]` brush</span>
                <span>`Cmd/Ctrl+S` save</span>
              </div>
            </div>
          </div>
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
