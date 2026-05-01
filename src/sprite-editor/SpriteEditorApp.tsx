import { useEffect, useMemo, useRef, useState } from 'react';

import { loadSpriteAssetImage } from './assetLoading';
import {
  runCopySelection,
  runPasteSelection,
  runResizeCanvas,
  runRevert,
  runSave,
  runSelectAsset,
  runUndoRedo,
} from './editorOperations';
import {
  beginDocumentHistorySession as beginDocumentHistorySessionState,
  beginPatchHistorySession as beginPatchHistorySessionState,
  commitMoveOffsetToCanvas,
  discardCurrentHistorySession as discardCurrentHistorySessionState,
  extendCurrentPatchHistorySession as extendCurrentPatchHistorySessionState,
  finalizeCurrentHistorySession as finalizeCurrentHistorySessionState,
  type PendingSpriteHistorySession,
  type SpriteHistoryEntry,
} from './documentCommands';
import {
  beginMoveInteraction,
  beginPaintInteraction,
  beginSelectionInteraction,
  finalizeSelectionInteraction,
  pickColorAtPoint,
  type MoveDragOrigin,
  updateMoveInteraction,
  updatePaintInteraction,
  updateSelectionInteraction,
} from './interactionCommands';
import { registerSpriteEditorKeyboardShortcuts } from './keyboardShortcuts';
import {
  getGridSourcesForSpriteAsset,
  spriteAssets,
  spriteAssetsByCategory,
  type SpriteAssetGridSource,
} from './assetCatalog';
import { BrushColorPanel } from './components/BrushColorPanel';
import { BrushSettingsPanel } from './components/BrushSettingsPanel';
import { SpriteEditorActionsMenu } from './components/SpriteEditorActionsMenu';
import { SpriteToolPicker } from './components/SpriteToolPicker';
import { StatusBanner } from './components/StatusBanner';
import { ZoomPanel } from './components/ZoomPanel';
import { AssetsSection } from './sections/AssetsSection';
import { GridSection } from './sections/GridSection';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/components/Resizable';
import { Switch } from '@/ui/components/Switch';
import {
  useSpriteEditorStore,
  normalizeGridSettings,
  type PixelRect,
} from './state/spriteEditorStore';
import { clampAlpha, clampBrushSize, clampZoom, cloneImageData, cropImageData, getPixelCoordinates, parseHexColor, rgbaToHex } from './utils';

type PointerOrigin = { x: number; y: number };
type PanOrigin = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
};
type SpriteEditorSession = {
  isSelectionCopy: boolean;
  lastPointer: PointerOrigin | null;
  moveDragOrigin: MoveDragOrigin | null;
  moveSourceImageData: ImageData | null;
  originalImageData: ImageData | null;
  panOrigin: PanOrigin | null;
  pendingHistorySession: PendingSpriteHistorySession | null;
  selectionDragOrigin: PointerOrigin | null;
  selectionPixels: ImageData | null;
};

export function SpriteEditorApp() {
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<SpriteEditorSession>({
    isSelectionCopy: false,
    lastPointer: null,
    moveDragOrigin: null,
    moveSourceImageData: null,
    originalImageData: null,
    panOrigin: null,
    pendingHistorySession: null,
    selectionDragOrigin: null,
    selectionPixels: null,
  });
  const [dirty, setDirty] = useState(false);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number } | null>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
  const [undoStack, setUndoStack] = useState<SpriteHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<SpriteHistoryEntry[]>([]);
  const activeAssetPath = useSpriteEditorStore((state) => state.activeAssetPath);
  const brushColor = useSpriteEditorStore((state) => state.brushColor);
  const brushSize = useSpriteEditorStore((state) => state.brushSize);
  const gridColor = useSpriteEditorStore((state) => state.gridColor);
  const gridOpacity = useSpriteEditorStore((state) => state.gridOpacity);
  const gridSettings = useSpriteEditorStore((state) => state.gridSettings);
  const interactionMode = useSpriteEditorStore((state) => state.interactionMode);
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
  const viewportOffset = useSpriteEditorStore((state) => state.viewportOffset);
  const zoom = useSpriteEditorStore((state) => state.zoom);
  const handlers = useSpriteEditorStore((state) => state.handlers);
  const session = sessionRef.current;

  const activeAsset = useMemo(
    () => spriteAssets.find((asset) => asset.assetPath === activeAssetPath) ?? null,
    [activeAssetPath],
  );
  const matchingGridSources = useMemo(
    () => (activeAssetPath ? getGridSourcesForSpriteAsset(activeAssetPath) : []),
    [activeAssetPath],
  );

  const resetInteractionRefs = () => {
    session.selectionDragOrigin = null;
    session.moveDragOrigin = null;
    session.lastPointer = null;
  };

  const resetSelectionState = () => {
    session.selectionPixels = null;
    session.isSelectionCopy = false;
    resetInteractionRefs();
    handlers.setSelectionRect(null);
    setMoveOffset({ x: 0, y: 0 });
  };

  const syncCanvasSelectionSnapshot = (ctx: CanvasRenderingContext2D, nextSelectionRect: PixelRect | null) => {
    const snapshot = cloneImageData(ctx);
    session.moveSourceImageData = snapshot;
    session.selectionPixels = nextSelectionRect ? cropImageData(snapshot, nextSelectionRect) : null;
    session.isSelectionCopy = false;
  };

  const centerCanvas = (nextZoom = zoom) => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) {
      return;
    }

    handlers.setViewportOffset({
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
      handlers.setZoom(nextZoom);
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const focusX = focusPoint ? focusPoint.clientX - rect.left : viewport.clientWidth / 2;
    const focusY = focusPoint ? focusPoint.clientY - rect.top : viewport.clientHeight / 2;
    const worldX = (focusX - viewportOffset.x) / zoom;
    const worldY = (focusY - viewportOffset.y) / zoom;

    handlers.setZoom(nextZoom);
    handlers.setViewportOffset({
      x: Math.round(focusX - worldX * nextZoom),
      y: Math.round(focusY - worldY * nextZoom),
    });
  };

  const applyGridSource = (source: SpriteAssetGridSource, options?: { announce?: boolean; makeVisible?: boolean }) => {
    handlers.applyGridSettings(normalizeGridSettings(source.grid));
    if (options?.makeVisible ?? true) {
      handlers.setIsGridVisible(true);
    }
    if (options?.announce ?? true) {
      handlers.setMessage(`Loaded grid from ${source.id}.`);
    }
    handlers.setLoadError(null);
  };

  const commitMoveOffset = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }

    const result = commitMoveOffsetToCanvas({
      ctx,
      isSelectionCopy: session.isSelectionCopy,
      moveOffset,
      moveSourceImage: session.moveSourceImageData,
      selectionPixels: session.selectionPixels,
      selectionRect,
    });
    session.moveSourceImageData = result.moveSourceImage;
    session.selectionPixels = result.nextSelectionPixels;
    handlers.setSelectionRect(result.nextSelectionRect);
    setMoveOffset(result.nextMoveOffset);
  };

  const clearSelection = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && moveOffset.x !== 0 && moveOffset.y !== 0) {
      commitMoveOffset();
    }

    resetSelectionState();
  };

  const finishLoadingDocument = (ctx: CanvasRenderingContext2D) => {
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
  };

  const loadActiveAsset = () => {
    if (!activeAsset) {
      return;
    }

    return loadSpriteAssetImage({
      asset: activeAsset,
      canvas: canvasRef.current,
      onError: (message) => {
        handlers.setLoadError(message);
        handlers.setIsLoading(false);
      },
      onLoaded: (ctx) => {
        finishLoadingDocument(ctx);
        window.requestAnimationFrame(() => {
          centerCanvas(zoom);
        });
      },
      onStart: () => {
        handlers.setIsLoading(true);
        handlers.setLoadError(null);
        handlers.setMessage(null);
      },
    });
  };

  useEffect(() => {
    return loadActiveAsset();
  }, [activeAsset]);

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

  const beginPatchHistorySession = (label: string, bounds: PixelRect) => {
    beginPatchHistorySessionState({
      bounds,
      canvas: canvasRef.current,
      label,
      session,
    });
  };

  const extendCurrentPatchHistorySession = (bounds: PixelRect) => {
    extendCurrentPatchHistorySessionState({
      bounds,
      canvas: canvasRef.current,
      session,
    });
  };

  const beginDocumentHistorySession = (label: string) => {
    beginDocumentHistorySessionState({
      canvas: canvasRef.current,
      label,
      session,
    });
  };

  const finalizeCurrentHistorySession = () => {
    finalizeCurrentHistorySessionState({
      canvas: canvasRef.current,
      session,
      setRedoStack,
      setUndoStack,
    });
  };

  const discardCurrentHistorySession = () => {
    discardCurrentHistorySessionState(session);
  };

  const documentController = {
    beginDocumentHistorySession,
    canvas: canvasRef.current,
    centerCanvas: () => centerCanvas(zoom),
    cloneCanvasImage: () => {
      const ctx = canvasRef.current?.getContext('2d');
      return ctx ? cloneImageData(ctx) : null;
    },
    commitMoveOffset,
    discardCurrentHistorySession,
    finalizeCurrentHistorySession,
    getContext: () => canvasRef.current?.getContext('2d'),
    resetInteractionRefs,
    resetSelectionState,
    session,
    syncCanvasSelectionSnapshot,
  };
  const documentUi = {
    setDirty,
    setHoveredPixel,
    setIsActionsOpen,
    setIsSaving: handlers.setIsSaving,
    setLoadError: handlers.setLoadError,
    setMessage: handlers.setMessage,
    setMoveOffset,
    setSelectionRect: handlers.setSelectionRect,
    setTool: handlers.setTool,
  };

  const getCanvasSelectionImageData = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !selectionRect) {
      return null;
    }

    if (moveOffset.x !== 0 || moveOffset.y !== 0) {
      commitMoveOffset();
    }

    const safeX = Math.max(0, Math.min(selectionRect.x, canvas.width - 1));
    const safeY = Math.max(0, Math.min(selectionRect.y, canvas.height - 1));
    const safeWidth = Math.max(1, Math.min(selectionRect.width, canvas.width - safeX));
    const safeHeight = Math.max(1, Math.min(selectionRect.height, canvas.height - safeY));
    return ctx.getImageData(safeX, safeY, safeWidth, safeHeight);
  };

  const handleCopySelection = async () => {
    await runCopySelection({
      getCanvasSelectionImageData,
      setLoadError: handlers.setLoadError,
      setMessage: handlers.setMessage,
    });
  };

  const handlePasteSelection = async (blob: Blob) => {
    await runPasteSelection({
      blob,
      controller: documentController,
      preferredPosition: { x: selectionRect?.x ?? 0, y: selectionRect?.y ?? 0 },
      ui: documentUi,
    });
  };

  const handleSelectAsset = (nextAssetPath: string) => {
    runSelectAsset({ activeAssetPath, dirty, nextAssetPath, setActiveAssetPath: handlers.setActiveAssetPath });
  };

  const handleBrushColorChange = (hexColor: string) => {
    const nextColor = parseHexColor(hexColor);
    handlers.setBrushColor((current) => ({ ...nextColor, a: current.a }));
  };

  const handleBrushAlphaChange = (nextPercent: number) => {
    const clampedPercent = Math.max(0, Math.min(100, nextPercent));
    handlers.setBrushColor((current) => ({
      ...current,
      a: clampAlpha(Math.round((clampedPercent / 100) * 255)),
    }));
  };

  const handleUndo = () => {
    runUndoRedo({
      controller: documentController,
      direction: 'undo',
      entry: undoStack[undoStack.length - 1],
      ui: { setDirty, setRedoStack, setUndoStack },
    });
  };

  const handleRedo = () => {
    runUndoRedo({
      controller: documentController,
      direction: 'redo',
      entry: redoStack[redoStack.length - 1],
      ui: { setDirty, setRedoStack, setUndoStack },
    });
  };

  const handleRevert = () => {
    runRevert({
      controller: documentController,
      dirty,
      originalImageData: session.originalImageData,
      ui: {
        setDirty,
        setMessage: handlers.setMessage,
        setRedoStack,
        setUndoStack,
      },
    });
  };

  const handleSave = async () => {
    await runSave({
      activeAsset,
      controller: documentController,
      isLoading,
      isSaving,
      moveOffset,
      selectionRect,
      ui: documentUi,
    });
  };

  const handleResizeCanvas = () => {
    runResizeCanvas({
      controller: documentController,
      moveOffset,
      ui: documentUi,
    });
  };

  useEffect(() => {
    return registerSpriteEditorKeyboardShortcuts({
      centerCanvas: () => centerCanvas(zoom),
      clearSelection,
      copySelection: handleCopySelection,
      handlePasteSelection,
      hasSelection: selectionRect !== null,
      handleRedo,
      handleSave,
      handleUndo,
      setBrushSize: (updater) => handlers.setBrushSize((current) => clampBrushSize(updater(current))),
      setIsSpacePressed: handlers.setIsSpacePressed,
      setTool: handlers.setTool,
      zoomIn: () => applyZoom(zoom + 2),
      zoomOut: () => applyZoom(zoom - 2),
    });
  }, [handleRedo, handleSave, handleUndo, selectionRect, zoom]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const shouldPan = event.button === 1 || (event.button === 0 && isSpacePressed);
    if (shouldPan) {
      event.preventDefault();
      session.panOrigin = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: viewportOffset.x,
        startOffsetY: viewportOffset.y,
      };
      handlers.setInteractionMode('pan');
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0 || !canvas || !ctx) {
      const activeTool = event.altKey ? 'picker' : tool;
      if (activeTool === 'select' && selectionRect) {
        clearSelection();
      }
      return;
    }

    const point = getPixelCoordinates(canvas, event);
    const activeTool = event.altKey ? 'picker' : tool;
    if (!point) {
      if (activeTool === 'select' && selectionRect) {
        clearSelection();
      }
      return;
    }

    if (activeTool === 'select') {
      if (moveOffset.x !== 0 || moveOffset.y !== 0) {
        commitMoveOffset();
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      session.selectionDragOrigin = point;
      handlers.setSelectionRect(beginSelectionInteraction(point));
      handlers.setInteractionMode('select');
      return;
    }

    if (activeTool === 'move') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      beginDocumentHistorySession('Move');
      const moveStart = beginMoveInteraction({
        ctx,
        isSelectionCopy: session.isSelectionCopy,
        moveOffset,
        moveSourceImage: session.moveSourceImageData,
        point,
        selectionRect,
      });
      session.moveDragOrigin = moveStart.moveDragOrigin;
      session.moveSourceImageData = moveStart.nextMoveSourceImage;
      if (moveStart.nextSelectionPixels) {
        session.selectionPixels = moveStart.nextSelectionPixels;
      }
      handlers.setInteractionMode('move');
      return;
    }

    if (activeTool === 'picker') {
      handlers.setBrushColor(pickColorAtPoint(ctx, point));
      return;
    }

    if (moveOffset.x !== 0 || moveOffset.y !== 0) {
      commitMoveOffset();
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const paintStart = beginPaintInteraction({ activeTool, brushColor, brushSize, ctx, point });
    beginPatchHistorySession('Brush', paintStart.historyBounds);
    session.lastPointer = paintStart.lastPointer;
    handlers.setInteractionMode('paint');
    setDirty(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    const canvas = canvasRef.current;
    if (!canvas || !ctx) {
      return;
    }

    const point = getPixelCoordinates(canvas, event);
    setHoveredPixel(point);

    if (interactionMode === 'pan') {
      const panOrigin = session.panOrigin;
      if (!panOrigin) {
        return;
      }
      handlers.setViewportOffset({
        x: panOrigin.startOffsetX + (event.clientX - panOrigin.startClientX),
        y: panOrigin.startOffsetY + (event.clientY - panOrigin.startClientY),
      });
      return;
    }

    if (interactionMode === 'select') {
      const selectionOrigin = session.selectionDragOrigin;
      if (!selectionOrigin || !point) {
        return;
      }
      handlers.setSelectionRect(updateSelectionInteraction(selectionOrigin, point));
      return;
    }

    if (interactionMode === 'move') {
      const moveOrigin = session.moveDragOrigin;
      const moveSourceImage = session.moveSourceImageData;
      if (!moveOrigin || !moveSourceImage || !point) {
        return;
      }
      const nextOffset = updateMoveInteraction({
        ctx,
        isSelectionCopy: session.isSelectionCopy,
        moveOrigin,
        moveSourceImage,
        point,
        selectionPixels: session.selectionPixels,
        selectionRect,
      });
      setMoveOffset(nextOffset);
      setDirty(true);
      return;
    }

    if ((event.buttons & 1) !== 1 || interactionMode !== 'paint') {
      return;
    }

    const previousPoint = session.lastPointer;
    if (!point || !previousPoint) {
      return;
    }
    const paintUpdate = updatePaintInteraction({
      brushColor,
      brushSize,
      ctx,
      point,
      previousPoint,
      tool,
    });
    extendCurrentPatchHistorySession(paintUpdate.historyBounds);
    session.lastPointer = paintUpdate.lastPointer;
    setDirty(true);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    session.panOrigin = null;
    resetInteractionRefs();
    if (interactionMode === 'select') {
      const selectionResult = finalizeSelectionInteraction({
        moveSourceImage: session.moveSourceImageData,
        selectionRect,
      });
      session.selectionPixels = selectionResult.selectionPixels;
      session.isSelectionCopy = selectionResult.isSelectionCopy;
    }
    if (interactionMode === 'paint' || interactionMode === 'move') {
      finalizeCurrentHistorySession();
    } else {
      discardCurrentHistorySession();
    }
    handlers.setInteractionMode('idle');
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const direction = event.deltaY < 0 ? 1 : -1;
      const step = event.shiftKey ? 4 : 2;
      applyZoom(zoom + direction * step, { clientX: event.clientX, clientY: event.clientY });
      return;
    }

    handlers.setViewportOffset((current) => ({
      x: current.x - Math.round(event.deltaX),
      y: current.y - Math.round(event.deltaY),
    }));
  };

  const displayedSelectionRect =
    selectionRect === null
      ? null
      : {
          ...selectionRect,
          x: selectionRect.x + moveOffset.x,
          y: selectionRect.y + moveOffset.y,
        };
  const gridStepX = gridSettings.frameWidth + (gridSettings.gapX ?? 0);
  const gridStepY = gridSettings.frameHeight + (gridSettings.gapY ?? 0);
  const scaledCanvasWidth = canvasRef.current ? Math.round(canvasRef.current.width * zoom) : 0;
  const scaledCanvasHeight = canvasRef.current ? Math.round(canvasRef.current.height * zoom) : 0;
  const scaledGridStepX = Math.round(gridStepX * zoom);
  const scaledGridStepY = Math.round(gridStepY * zoom);
  const scaledGridOffsetX = Math.round((gridSettings.offsetX ?? 0) * zoom);
  const scaledGridOffsetY = Math.round((gridSettings.offsetY ?? 0) * zoom);
  const gridLines = {
    horizontal:
      isGridVisible && activeAsset && gridSettings.frameHeight > 0 && scaledGridStepY > 0
        ? Array.from(
            {
              length:
                Math.floor(Math.max(scaledCanvasHeight - scaledGridOffsetY, 0) / scaledGridStepY) +
                1,
            },
            (_, index) => scaledGridOffsetY + index * scaledGridStepY,
          ).filter((position) => position >= 0 && position <= scaledCanvasHeight)
        : [],
    vertical:
      isGridVisible && activeAsset && gridSettings.frameWidth > 0 && scaledGridStepX > 0
        ? Array.from(
            {
              length:
                Math.floor(Math.max(scaledCanvasWidth - scaledGridOffsetX, 0) / scaledGridStepX) +
                1,
            },
            (_, index) => scaledGridOffsetX + index * scaledGridStepX,
          ).filter((position) => position >= 0 && position <= scaledCanvasWidth)
        : [],
  };
  const view = {
    activeHexColor: rgbaToHex(brushColor),
    brushPreview:
      hoveredPixel && activeAsset && interactionMode !== 'pan'
        ? {
            left: viewportOffset.x + (hoveredPixel.x - Math.floor(brushSize / 2)) * zoom,
            size: brushSize * zoom,
            top: viewportOffset.y + (hoveredPixel.y - Math.floor(brushSize / 2)) * zoom,
          }
        : null,
    canvasCursor:
      interactionMode === 'pan'
        ? 'grabbing'
        : isSpacePressed
          ? 'grab'
          : tool === 'move'
            ? 'move'
            : tool === 'picker'
              ? 'cell'
              : 'crosshair',
    canvasSizeLabel: canvasRef.current
      ? `${canvasRef.current.width} x ${canvasRef.current.height}`
      : '—',
    displayedSelectionRect,
    gridColorWithAlpha: `${gridColor}${Math.round(gridOpacity * 255)
      .toString(16)
      .padStart(2, '0')}`,
    gridLines,
    gridOverlay:
      gridLines.vertical.length > 0 || gridLines.horizontal.length > 0
        ? {
            height: `${scaledCanvasHeight}px`,
            left: `${viewportOffset.x}px`,
            top: `${viewportOffset.y}px`,
            width: `${scaledCanvasWidth}px`,
          }
        : null,
    selectionOverlay:
      displayedSelectionRect === null
        ? null
        : {
            height: `${displayedSelectionRect.height * zoom}px`,
            left: `${viewportOffset.x + displayedSelectionRect.x * zoom}px`,
            top: `${viewportOffset.y + displayedSelectionRect.y * zoom}px`,
            width: `${displayedSelectionRect.width * zoom}px`,
          },
  };
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      id="sprite-editor-layout"
      onLayoutChanged={(layout) => {
        const nextSidebarSize = layout['sprite-editor-sidebar'];
        if (typeof nextSidebarSize === 'number' && Number.isFinite(nextSidebarSize)) {
          handlers.setSidebarSize(nextSidebarSize);
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
            <Switch checked={isSidebarResizable} onCheckedChange={handlers.setIsSidebarResizable} />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            <GridSection
              applyGridSource={applyGridSource}
              gridColor={gridColor}
              gridOpacity={gridOpacity}
              gridSettings={gridSettings}
              isGridVisible={isGridVisible}
              matchingGridSources={matchingGridSources}
              setGridColor={handlers.setGridColor}
              setGridOpacity={handlers.setGridOpacity}
              setIsGridVisible={handlers.setIsGridVisible}
              updateGridNumber={handlers.updateGridNumber}
            />

            <AssetsSection
              activeAssetPath={activeAssetPath}
              assetsByCategory={spriteAssetsByCategory}
              onSelectAsset={handleSelectAsset}
              totalAssetCount={spriteAssets.length}
            />
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
                <div ref={actionsMenuRef}>
                  <SpriteEditorActionsMenu
                    canvasSizeLabel={view.canvasSizeLabel}
                    isOpen={isActionsOpen}
                    onResizeCanvas={handleResizeCanvas}
                    onToggle={() => setIsActionsOpen((current) => !current)}
                  />
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
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={!activeAsset || isLoading || isSaving || !dirty}
                  className="rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100 transition hover:border-cyan-300 disabled:opacity-40"
                >
                  Save PNG
                </button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 p-4 xl:grid-cols-[auto_auto_auto_auto]">
              <SpriteToolPicker activeTool={tool} onSelectTool={handlers.setTool} />

              <BrushColorPanel
                activeHexColor={view.activeHexColor}
                brushColor={brushColor}
                onColorChange={handleBrushColorChange}
              />

              <BrushSettingsPanel
                alphaPercent={Math.round((brushColor.a / 255) * 100)}
                brushSize={brushSize}
                onAlphaChange={handleBrushAlphaChange}
                onBrushSizeChange={(nextBrushSize) => handlers.setBrushSize(clampBrushSize(nextBrushSize))}
              />

              <ZoomPanel zoom={zoom} onCenter={() => centerCanvas(zoom)} onZoomChange={applyZoom} />
            </div>

            <StatusBanner message={message} loadError={loadError} />

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
                cursor: view.canvasCursor,
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
                  {view.gridOverlay ? (
                    <div
                      className="pointer-events-none absolute"
                      style={view.gridOverlay ?? undefined}
                    >
                      {view.gridLines.vertical.map((position) => (
                        <div
                          key={`grid-v-${position}`}
                          className="absolute top-0"
                          style={{
                            backgroundColor: view.gridColorWithAlpha,
                            height: `${scaledCanvasHeight}px`,
                            left: `${position}px`,
                            width: '1px',
                          }}
                        />
                      ))}
                      {view.gridLines.horizontal.map((position) => (
                        <div
                          key={`grid-h-${position}`}
                          className="absolute left-0"
                          style={{
                            backgroundColor: view.gridColorWithAlpha,
                            height: '1px',
                            top: `${position}px`,
                            width: `${scaledCanvasWidth}px`,
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {view.selectionOverlay ? (
                    <div
                      className="pointer-events-none absolute border border-cyan-300"
                      style={{
                        ...view.selectionOverlay,
                        boxShadow: '0 0 0 1px rgba(8,145,178,0.45)',
                      }}
                    >
                      <div className="h-full w-full border border-dashed border-white/80" />
                    </div>
                  ) : null}
                  {view.brushPreview ? (
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
                        height: `${view.brushPreview.size}px`,
                        left: `${view.brushPreview.left}px`,
                        top: `${view.brushPreview.top}px`,
                        width: `${view.brushPreview.size}px`,
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
                <div>Canvas {view.canvasSizeLabel}</div>
                <div>Tool {tool}</div>
                <div>Brush {brushSize}px</div>
                <div>Zoom {zoom}x</div>
                <div>
                  Selection{' '}
                  {view.displayedSelectionRect
                    ? `${view.displayedSelectionRect.width} x ${view.displayedSelectionRect.height}`
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
