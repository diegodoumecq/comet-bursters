import { useEffect, useRef, useState } from 'react';

import columnPixelartUrl from '../assets/columnPixelart.png';
import type { ShipInteriorTileId } from '../shipInterior/level';
import { useEditorStore } from './state/editorStore';
import {
  buildMaterialOverlayCanvas,
  buildTileLayerCanvas,
  drawEditorCanvas,
  getCanvasWorldCoordinates,
} from './canvasDrawing';

export type EditorCanvasPointerInfo = {
  button: number;
  buttons: number;
  shiftKey: boolean;
};

export type EditorCanvasPreviewTile = {
  layerId: string;
  tileId: ShipInteriorTileId;
  x: number;
  y: number;
};

export type EditorCanvasPreviewMaterialCell = {
  material: string;
  x: number;
  y: number;
};

export type EditorCanvasRectanglePreview = {
  color: string;
  endX: number;
  endY: number;
  materialCells: EditorCanvasPreviewMaterialCell[];
  startX: number;
  startY: number;
  tileOverrides: EditorCanvasPreviewTile[];
};

export function EditorCanvas({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSecondaryInteraction,
  rectanglePreview,
  zoom,
}: {
  onPointerDown: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onPointerMove: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onPointerUp: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onSecondaryInteraction: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  rectanglePreview: EditorCanvasRectanglePreview | null;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const materialOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileLayerCanvasesRef = useRef<{
    overhead: HTMLCanvasElement | null;
    underlay: HTMLCanvasElement | null;
  }>({
    overhead: null,
    underlay: null,
  });
  const images = useEditorStore((state) => state.images);
  const inactiveLayerOpacity = useEditorStore((state) => state.inactiveLayerOpacity);
  const layerVisibility = useEditorStore((state) => state.layerVisibility);
  const level = useEditorStore((state) => state.level);
  const materialPlacements = useEditorStore((state) => state.materialPlacements);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
  const selectedPathId = useEditorStore((state) => state.selectedPathId);
  const tool = useEditorStore((state) => state.tool);
  const columnImageRef = useRef<HTMLImageElement | null>(null);
  const [, setColumnImageVersion] = useState(0);

  useEffect(() => {
    const image = new Image();
    image.src = columnPixelartUrl;
    image.onload = () => {
      columnImageRef.current = image;
      setColumnImageVersion((current) => current + 1);
    };
    columnImageRef.current = image;
  }, []);

  useEffect(() => {
    if (tool !== 'materials') {
      return;
    }

    materialOverlayCanvasRef.current = buildMaterialOverlayCanvas({
      layerVisibility,
      level,
      materialPlacements,
      selectedLayerId,
    });
  }, [layerVisibility, level, materialPlacements, selectedLayerId, tool]);

  useEffect(() => {
    tileLayerCanvasesRef.current = {
      overhead: buildTileLayerCanvas({
        images,
        inactiveLayerOpacity,
        layerVisibility,
        level,
        overhead: true,
        selectedLayerId,
      }),
      underlay: buildTileLayerCanvas({
        images,
        inactiveLayerOpacity,
        layerVisibility,
        level,
        overhead: false,
        selectedLayerId,
      }),
    };
  }, [images, inactiveLayerOpacity, layerVisibility, level, selectedLayerId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = level.width;
    canvas.height = level.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    drawEditorCanvas({
      columnImage: columnImageRef.current,
      ctx,
      images,
      layerVisibility,
      level,
      materialOverlayCanvas: materialOverlayCanvasRef.current,
      rectanglePreview,
      selectedEntityId,
      selectedLayerId,
      selectedPathId,
      tileLayerCanvases: tileLayerCanvasesRef.current,
      tool,
    });
  }, [
    images,
    layerVisibility,
    level,
    rectanglePreview,
    selectedEntityId,
    selectedLayerId,
    selectedPathId,
    tool,
  ]);

  const getWorldCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>,
  ) => {
    return getCanvasWorldCoordinates(event.currentTarget, event.clientX, event.clientY);
  };

  const handlePointerEvent = (
    event: React.PointerEvent<HTMLCanvasElement>,
    handler: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void,
  ) => {
    const { worldX, worldY } = getWorldCoordinates(event);
    handler(worldX, worldY, {
      button: event.button,
      buttons: event.buttons,
      shiftKey: event.shiftKey,
    });
  };

  return (
    <div className="inline-block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          if (event.button !== 0 && event.button !== 2) {
            return;
          }
          if (event.button === 2) {
            event.preventDefault();
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointerEvent(event, event.button === 2 ? onSecondaryInteraction : onPointerDown);
        }}
        onPointerMove={(event) => {
          if ((event.buttons & 3) === 0) {
            return;
          }
          if ((event.buttons & 2) === 2) {
            event.preventDefault();
          }
          handlePointerEvent(event, onPointerMove);
        }}
        onPointerUp={(event) => {
          if (event.button !== 0 && event.button !== 2) {
            return;
          }
          if (event.button === 2) {
            event.preventDefault();
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          handlePointerEvent(event, onPointerUp);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
        className="block max-w-none cursor-crosshair bg-slate-950"
        style={{
          height: `${level.height * zoom}px`,
          imageRendering: 'pixelated',
          width: `${level.width * zoom}px`,
        }}
        data-tool={tool}
      />
    </div>
  );
}
