import { useEffect, useRef } from 'react';

import { useEditorStore } from '../state/editorStore';

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
}: {
  onPointerDown: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onPointerMove: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onPointerUp: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
  onSecondaryInteraction: (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const images = useEditorStore((state) => state.images);
  const inactiveLayerOpacity = useEditorStore((state) => state.inactiveLayerOpacity);
  const layerVisibility = useEditorStore((state) => state.layerVisibility);
  const level = useEditorStore((state) => state.level);
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
    for (let x = 0; x <= level.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, level.height);
      ctx.stroke();
    }
    for (let y = 0; y <= level.height; y += 32) {
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

        ctx.save();
        ctx.globalAlpha =
          (layer.opacity ?? 1) * (layer.id === selectedLayerId ? 1 : inactiveLayerOpacity);
        for (const tile of layer.tiles) {
          const frame = tileset.tiles[tile.tile];
          if (!frame) {
            continue;
          }

          ctx.drawImage(
            image,
            frame[0] * tileset.grid.frameWidth,
            frame[1] * tileset.grid.frameHeight,
            tileset.grid.frameWidth,
            tileset.grid.frameHeight,
            tile.x * tileset.grid.frameWidth,
            tile.y * tileset.grid.frameHeight,
            tileset.grid.frameWidth,
            tileset.grid.frameHeight,
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

    if (tool === 'paths' && selectedPathId) {
      const selectedPath = level.paths.find((path) => path.id === selectedPathId);
      if (selectedPath && selectedPath.patrol.length > 0) {
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.fillStyle = '#22d3ee';
        ctx.lineWidth = 3;

        if (selectedPath.patrol.length > 1) {
          ctx.beginPath();
          ctx.moveTo(selectedPath.patrol[0].x, selectedPath.patrol[0].y);
          for (const point of selectedPath.patrol.slice(1)) {
            ctx.lineTo(point.x, point.y);
          }
          if (selectedPath.closed) {
            ctx.lineTo(selectedPath.patrol[0].x, selectedPath.patrol[0].y);
          }
          ctx.stroke();
        }

        selectedPath.patrol.forEach((point, index) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, index === 0 ? 10 : 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#082f49';
          ctx.stroke();

          ctx.fillStyle = '#ecfeff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(String(index + 1), point.x, point.y + 3);
          ctx.fillStyle = '#22d3ee';
        });

        ctx.restore();
      }
    }
  }, [
    images,
    inactiveLayerOpacity,
    layerVisibility,
    level,
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
        style={{ imageRendering: 'pixelated' }}
        data-tool={tool}
      />
    </div>
  );
}
