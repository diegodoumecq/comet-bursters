import { useEffect, useRef } from 'react';

import { getLevelGrid, getTilesetTilePositionMap } from '../scenes/ShipInteriorScene/level';
import { getMaterialColor } from './shared/materials';
import { useEditorStore } from './state/editorStore';

export type EditorCanvasPointerInfo = {
  button: number;
  buttons: number;
  shiftKey: boolean;
};

export function EditorCanvas({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onSecondaryInteraction,
  zoom,
}: {
  onPointerDown: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onPointerMove: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onPointerUp: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onSecondaryInteraction: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const images = useEditorStore((state) => state.images);
  const inactiveLayerOpacity = useEditorStore((state) => state.inactiveLayerOpacity);
  const layerVisibility = useEditorStore((state) => state.layerVisibility);
  const level = useEditorStore((state) => state.level);
  const materialPlacements = useEditorStore((state) => state.materialPlacements);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
  const selectedPathId = useEditorStore((state) => state.selectedPathId);
  const tool = useEditorStore((state) => state.tool);

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#08111d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    const levelGrid = getLevelGrid(level);
    for (let x = 0; x <= level.width; x += levelGrid.cellWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, level.height);
      ctx.stroke();
    }
    for (let y = 0; y <= level.height; y += levelGrid.cellHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(level.width, y);
      ctx.stroke();
    }

    const drawLayerTiles = (overhead: boolean) => {
      for (const layer of level.layers) {
        if ((layer.overhead ?? false) !== overhead) {
          continue;
        }
        if (layerVisibility[layer.id] === false) {
          continue;
        }

        const tileset = level.tilesets.find((candidate) => candidate.id === layer.tilesetId);
        if (!tileset) {
          continue;
        }

        const image = images[tileset.id];
        if (!image) {
          continue;
        }

        const tilePositions = getTilesetTilePositionMap(tileset);
        ctx.save();
        const layerOpacity = layer.opacity ?? 1;
        const editableLayerOpacity =
          layer.id === selectedLayerId ? Math.max(layerOpacity, 0.25) : layerOpacity;
        ctx.globalAlpha =
          editableLayerOpacity * (layer.id === selectedLayerId ? 1 : inactiveLayerOpacity);
        for (const tile of layer.tiles) {
          const tileX = tile.x * levelGrid.cellWidth;
          const tileY = tile.y * levelGrid.cellHeight;
          const frame = tilePositions[tile.tile];
          if (!frame) {
            const markerSize = Math.min(levelGrid.cellWidth, levelGrid.cellHeight);
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(244, 63, 94, 0.24)';
            ctx.fillRect(tileX, tileY, levelGrid.cellWidth, levelGrid.cellHeight);
            ctx.strokeStyle = '#fb7185';
            ctx.lineWidth = 2;
            ctx.strokeRect(tileX + 1, tileY + 1, levelGrid.cellWidth - 2, levelGrid.cellHeight - 2);
            ctx.fillStyle = '#fecdd3';
            ctx.font = `${Math.max(12, Math.floor(markerSize * 0.75))}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', tileX + levelGrid.cellWidth / 2, tileY + levelGrid.cellHeight / 2);
            ctx.restore();
            continue;
          }

          ctx.drawImage(
            image,
            frame[0] * tileset.grid.frameWidth,
            frame[1] * tileset.grid.frameHeight,
            tileset.grid.frameWidth,
            tileset.grid.frameHeight,
            tileX,
            tileY,
            layer.scaleToGrid ? levelGrid.cellWidth : tileset.grid.frameWidth,
            layer.scaleToGrid ? levelGrid.cellHeight : tileset.grid.frameHeight,
          );
        }
        ctx.restore();
      }
    };

    drawLayerTiles(false);

    for (const entity of level.entities) {
      const isPlayer = entity.type === 'player';
      const isSelected = entity.id === selectedEntityId;
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, isPlayer ? 14 : 11, 0, Math.PI * 2);
      ctx.fillStyle = isPlayer ? '#38bdf8' : '#f87171';
      ctx.fill();
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.strokeStyle = isSelected ? '#facc15' : '#020617';
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isPlayer ? 'P' : 'E', entity.x, entity.y + 3);
    }

    drawLayerTiles(true);

    const selectedEntity = level.entities.find((entity) => entity.id === selectedEntityId) ?? null;
    const inspectedEntityPath =
      selectedEntity?.type === 'enemy-patroller' && selectedEntity.pathId
        ? (level.paths.find((path) => path.id === selectedEntity.pathId) ?? null)
        : null;
    const selectedPath =
      tool === 'paths' && selectedPathId
        ? (level.paths.find((path) => path.id === selectedPathId) ?? null)
        : null;

    const drawPath = (
      path: (typeof level.paths)[number],
      colors: { fill: string; label: string; stroke: string; pointStroke: string },
    ) => {
      if (path.patrol.length === 0) {
        return;
      }

      ctx.save();
      ctx.strokeStyle = colors.stroke;
      ctx.fillStyle = colors.fill;
      ctx.lineWidth = 3;

      if (path.patrol.length > 1) {
        ctx.beginPath();
        ctx.moveTo(path.patrol[0].x, path.patrol[0].y);
        for (const point of path.patrol.slice(1)) {
          ctx.lineTo(point.x, point.y);
        }
        if (path.closed) {
          ctx.lineTo(path.patrol[0].x, path.patrol[0].y);
        }
        ctx.stroke();
      }

      path.patrol.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, index === 0 ? 10 : 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.pointStroke;
        ctx.stroke();

        ctx.fillStyle = colors.label;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), point.x, point.y + 3);
        ctx.fillStyle = colors.fill;
      });

      ctx.restore();
    };

    const drawMaterialOverlay = () => {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const layer of level.layers) {
        if (layerVisibility[layer.id] === false) {
          continue;
        }

        const layerMaterialPlacements = materialPlacements[layer.id];
        if (!layerMaterialPlacements) {
          continue;
        }

        for (const [key, material] of Object.entries(layerMaterialPlacements)) {
          const [x, y] = key.split(',').map((value) => Number.parseInt(value, 10));
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            continue;
          }

          const tileX = x * levelGrid.cellWidth;
          const tileY = y * levelGrid.cellHeight;
          ctx.globalAlpha = layer.id === selectedLayerId ? 0.88 : 0.62;
          ctx.fillStyle = getMaterialColor(material);
          ctx.fillRect(tileX, tileY, levelGrid.cellWidth, levelGrid.cellHeight);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            tileX + 0.5,
            tileY + 0.5,
            levelGrid.cellWidth - 1,
            levelGrid.cellHeight - 1,
          );
        }
      }

      ctx.restore();
    };

    if (inspectedEntityPath && inspectedEntityPath !== selectedPath) {
      drawPath(inspectedEntityPath, {
        fill: '#facc15',
        label: '#1f2937',
        pointStroke: '#713f12',
        stroke: '#facc15',
      });
    }

    if (selectedPath) {
      drawPath(selectedPath, {
        fill: '#22d3ee',
        label: '#ecfeff',
        pointStroke: '#082f49',
        stroke: '#22d3ee',
      });
    }

    if (tool === 'materials') {
      drawMaterialOverlay();
    }
  }, [
    images,
    inactiveLayerOpacity,
    layerVisibility,
    level,
    materialPlacements,
    selectedEntityId,
    selectedLayerId,
    selectedPathId,
    tool,
  ]);

  const getWorldCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    return {
      worldX: Math.round((event.clientX - rect.left) * scaleX),
      worldY: Math.round((event.clientY - rect.top) * scaleY),
    };
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
