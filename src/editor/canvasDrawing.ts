import {
  getLevelGrid,
  getTilesetTilePositionMap,
  type RawShipInteriorLevel,
} from '../scenes/ShipInteriorScene/level';
import type { EditorCanvasRectanglePreview } from './EditorCanvas';
import type { ImageMap } from './shared/editorTypes';
import { getMaterialColor, type MaterialPlacementMap } from './shared/materials';

type LayerVisibilityMap = Record<string, boolean>;

export function getCanvasWorldCoordinates(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { worldX: number; worldY: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    worldX: Math.round((clientX - rect.left) * scaleX),
    worldY: Math.round((clientY - rect.top) * scaleY),
  };
}

export function buildMaterialOverlayCanvas({
  layerVisibility,
  level,
  materialPlacements,
  selectedLayerId,
}: {
  layerVisibility: LayerVisibilityMap;
  level: RawShipInteriorLevel;
  materialPlacements: MaterialPlacementMap;
  selectedLayerId: string | null;
}): HTMLCanvasElement | null {
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = level.width;
  overlayCanvas.height = level.height;
  const overlayCtx = overlayCanvas.getContext('2d');
  if (!overlayCtx) {
    return null;
  }

  const levelGrid = getLevelGrid(level);
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);

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
      overlayCtx.globalAlpha = layer.id === selectedLayerId ? 0.88 : 0.62;
      overlayCtx.fillStyle = getMaterialColor(material);
      overlayCtx.fillRect(tileX, tileY, levelGrid.cellWidth, levelGrid.cellHeight);
      overlayCtx.globalAlpha = 1;
      overlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      overlayCtx.lineWidth = 1;
      overlayCtx.strokeRect(
        tileX + 0.5,
        tileY + 0.5,
        levelGrid.cellWidth - 1,
        levelGrid.cellHeight - 1,
      );
    }
  }

  return overlayCanvas;
}

export function buildTileLayerCanvas({
  images,
  inactiveLayerOpacity,
  layerVisibility,
  level,
  overhead,
  selectedLayerId,
}: {
  images: ImageMap;
  inactiveLayerOpacity: number;
  layerVisibility: LayerVisibilityMap;
  level: RawShipInteriorLevel;
  overhead: boolean;
  selectedLayerId: string | null;
}): HTMLCanvasElement | null {
  const levelGrid = getLevelGrid(level);
  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = level.width;
  layerCanvas.height = level.height;
  const layerCtx = layerCanvas.getContext('2d');
  if (!layerCtx) {
    return null;
  }

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
    layerCtx.save();
    const layerOpacity = layer.opacity ?? 1;
    const editableLayerOpacity =
      layer.id === selectedLayerId ? Math.max(layerOpacity, 0.25) : layerOpacity;
    layerCtx.globalAlpha =
      editableLayerOpacity * (layer.id === selectedLayerId ? 1 : inactiveLayerOpacity);
    for (const tile of layer.tiles) {
      const tileX = tile.x * levelGrid.cellWidth;
      const tileY = tile.y * levelGrid.cellHeight;
      const frame = tilePositions[String(tile.tile)];
      if (!frame) {
        drawMissingTileMarker(layerCtx, tileX, tileY, levelGrid.cellWidth, levelGrid.cellHeight);
        continue;
      }

      layerCtx.drawImage(
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
    layerCtx.restore();
  }

  return layerCanvas;
}

function drawMissingTileMarker(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  cellWidth: number,
  cellHeight: number,
) {
  const markerSize = Math.min(cellWidth, cellHeight);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(244, 63, 94, 0.24)';
  ctx.fillRect(tileX, tileY, cellWidth, cellHeight);
  ctx.strokeStyle = '#fb7185';
  ctx.lineWidth = 2;
  ctx.strokeRect(tileX + 1, tileY + 1, cellWidth - 2, cellHeight - 2);
  ctx.fillStyle = '#fecdd3';
  ctx.font = `${Math.max(12, Math.floor(markerSize * 0.75))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', tileX + cellWidth / 2, tileY + cellHeight / 2);
  ctx.restore();
}

export function drawEditorCanvas({
  columnImage,
  ctx,
  images,
  layerVisibility,
  level,
  materialOverlayCanvas,
  rectanglePreview,
  selectedEntityId,
  selectedLayerId,
  selectedPathId,
  tileLayerCanvases,
  tool,
}: {
  columnImage: HTMLImageElement | null;
  ctx: CanvasRenderingContext2D;
  images: ImageMap;
  layerVisibility: LayerVisibilityMap;
  level: RawShipInteriorLevel;
  materialOverlayCanvas: HTMLCanvasElement | null;
  rectanglePreview: EditorCanvasRectanglePreview | null;
  selectedEntityId: string | null;
  selectedLayerId: string | null;
  selectedPathId: string | null;
  tileLayerCanvases: { overhead: HTMLCanvasElement | null; underlay: HTMLCanvasElement | null };
  tool: string;
}) {
  ctx.clearRect(0, 0, level.width, level.height);
  ctx.fillStyle = '#08111d';
  ctx.fillRect(0, 0, level.width, level.height);

  const levelGrid = getLevelGrid(level);
  drawGrid(ctx, level.width, level.height, levelGrid.cellWidth, levelGrid.cellHeight);

  if (tileLayerCanvases.underlay) {
    ctx.drawImage(tileLayerCanvases.underlay, 0, 0);
  }

  drawEntities(ctx, level, selectedEntityId, columnImage);

  if (tileLayerCanvases.overhead) {
    ctx.drawImage(tileLayerCanvases.overhead, 0, 0);
  }

  const selectedEntity = level.entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const inspectedEntityPath =
    selectedEntity?.type === 'enemy-patroller' && selectedEntity.pathId
      ? (level.paths.find((path) => path.id === selectedEntity.pathId) ?? null)
      : null;
  const selectedPath =
    tool === 'paths' && selectedPathId
      ? (level.paths.find((path) => path.id === selectedPathId) ?? null)
      : null;

  if (inspectedEntityPath && inspectedEntityPath !== selectedPath) {
    drawPath(ctx, inspectedEntityPath, {
      fill: '#facc15',
      label: '#1f2937',
      pointStroke: '#713f12',
      stroke: '#facc15',
    });
  }

  if (selectedPath) {
    drawPath(ctx, selectedPath, {
      fill: '#22d3ee',
      label: '#ecfeff',
      pointStroke: '#082f49',
      stroke: '#22d3ee',
    });
  }

  if (tool === 'materials' && materialOverlayCanvas) {
    ctx.drawImage(materialOverlayCanvas, 0, 0);
  }

  if (rectanglePreview) {
    drawRectanglePreview(ctx, rectanglePreview, {
      images,
      layerVisibility,
      level,
      selectedLayerId,
    });
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellWidth: number,
  cellHeight: number,
) {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += cellWidth) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += cellHeight) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawEntities(
  ctx: CanvasRenderingContext2D,
  level: RawShipInteriorLevel,
  selectedEntityId: string | null,
  columnImage: HTMLImageElement | null,
) {
  for (const entity of level.entities) {
    const isPlayer = entity.type === 'player';
    const isColumn = entity.type === 'column';
    const isSelected = entity.id === selectedEntityId;
    if (isColumn && columnImage) {
      const drawX = Math.round(entity.x - columnImage.width / 2);
      const drawY = Math.round(entity.y - columnImage.height);
      ctx.drawImage(columnImage, drawX, drawY);
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeStyle = isSelected ? '#facc15' : 'rgba(8, 15, 28, 0.95)';
      ctx.strokeRect(drawX - 1, drawY - 1, columnImage.width + 2, columnImage.height + 2);
      continue;
    }

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
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  path: RawShipInteriorLevel['paths'][number],
  colors: { fill: string; label: string; stroke: string; pointStroke: string },
) {
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
}

function drawRectanglePreview(
  ctx: CanvasRenderingContext2D,
  rectanglePreview: EditorCanvasRectanglePreview,
  {
    images,
    layerVisibility,
    level,
    selectedLayerId,
  }: {
    images: ImageMap;
    layerVisibility: LayerVisibilityMap;
    level: RawShipInteriorLevel;
    selectedLayerId: string | null;
  },
) {
  const levelGrid = getLevelGrid(level);
  for (const materialCell of rectanglePreview.materialCells) {
    const tileX = materialCell.x * levelGrid.cellWidth;
    const tileY = materialCell.y * levelGrid.cellHeight;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = getMaterialColor(materialCell.material);
    ctx.fillRect(tileX, tileY, levelGrid.cellWidth, levelGrid.cellHeight);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tileX + 0.5, tileY + 0.5, levelGrid.cellWidth - 1, levelGrid.cellHeight - 1);
    ctx.restore();
  }

  for (const previewTile of rectanglePreview.tileOverrides) {
    const layer = level.layers.find((candidate) => candidate.id === previewTile.layerId);
    if (!layer || layerVisibility[layer.id] === false) {
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

    const frame = getTilesetTilePositionMap(tileset)[String(previewTile.tileId)];
    if (!frame) {
      continue;
    }

    const tileX = previewTile.x * levelGrid.cellWidth;
    const tileY = previewTile.y * levelGrid.cellHeight;
    ctx.save();
    ctx.globalAlpha = layer.id === selectedLayerId ? 0.95 : 0.85;
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
    ctx.restore();
  }

  const left = Math.min(rectanglePreview.startX, rectanglePreview.endX) * levelGrid.cellWidth;
  const top = Math.min(rectanglePreview.startY, rectanglePreview.endY) * levelGrid.cellHeight;
  const width =
    (Math.abs(rectanglePreview.endX - rectanglePreview.startX) + 1) * levelGrid.cellWidth;
  const height =
    (Math.abs(rectanglePreview.endY - rectanglePreview.startY) + 1) * levelGrid.cellHeight;

  ctx.save();
  ctx.strokeStyle = rectanglePreview.color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(left + 1, top + 1, Math.max(0, width - 2), Math.max(0, height - 2));
  ctx.restore();
}
