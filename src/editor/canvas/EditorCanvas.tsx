import { useEffect, useRef } from 'react';

import { useEditorStore } from '../state/editorStore';

export function EditorCanvas({
  onPrimaryInteraction,
  onSecondaryInteraction,
}: {
  onPrimaryInteraction: (worldX: number, worldY: number) => void;
  onSecondaryInteraction: (worldX: number, worldY: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const images = useEditorStore((state) => state.images);
  const level = useEditorStore((state) => state.level);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
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

    for (const layer of level.layers) {
      const tileset = level.tilesets.find((candidate) => candidate.id === layer.tilesetId);
      if (!tileset) {
        continue;
      }

      const image = images[tileset.id];
      if (!image) {
        continue;
      }

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
    }

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
  }, [images, level, selectedEntityId]);

  const handlePointer = (
    event: React.MouseEvent<HTMLCanvasElement>,
    handler: (worldX: number, worldY: number) => void,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    const worldX = Math.round((event.clientX - rect.left) * scaleX);
    const worldY = Math.round((event.clientY - rect.top) * scaleY);
    handler(worldX, worldY);
  };

  return (
    <div className="inline-block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
      <canvas
        ref={canvasRef}
        onClick={(event) => handlePointer(event, onPrimaryInteraction)}
        onContextMenu={(event) => {
          event.preventDefault();
          handlePointer(event, onSecondaryInteraction);
        }}
        className="block max-w-none cursor-crosshair bg-slate-950"
        style={{ imageRendering: 'pixelated' }}
        data-tool={tool}
      />
    </div>
  );
}
