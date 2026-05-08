import type { RawShipInteriorLevel } from '../scenes/ShipInteriorScene/level';
import type {
  EditorCanvasPreviewMaterialCell,
  EditorCanvasPreviewTile,
  EditorCanvasRectanglePreview,
} from './EditorCanvas';
import type { PlaceableEntityType } from './shared/editorTypes';
import { makeEntityId, placeTiles } from './shared/levelEditing';
import {
  applyMaterialPlacements,
  clearMaterialPlacements,
  getMaterialColor,
  getMaterialPlacementKey,
  refreshMaterialPlacementTilesForCells,
  resolveMaterialTilesForCells,
  type MaterialPlacementMap,
} from './shared/materials';
import type { EditorDocument } from './state/history';
import {
  getExpandedRectanglePreviewCells,
  getRectangleTargetCells,
  isCellOccupied,
  type RectangleDragContext,
  type RectangleDragState,
} from './utils';

export const BACKUP_PREFERENCE_STORAGE_KEY = 'comet-bursters.editor.create-backups';
const COLUMN_ENTITY_SPRITE = '../columnPixelart.png';

export function createPlacedEntity(
  currentLevel: RawShipInteriorLevel,
  selectedEntityType: PlaceableEntityType,
  selectedEntityPathId: string | null,
  worldX: number,
  worldY: number,
) {
  if (selectedEntityType === 'player') {
    return {
      id: 'player',
      type: 'player',
      x: worldX,
      y: worldY,
    } as const;
  }

  if (selectedEntityType === 'column') {
    return {
      id: makeEntityId(currentLevel, 'column'),
      type: 'column',
      x: worldX,
      y: worldY,
      sprite: COLUMN_ENTITY_SPRITE,
    } as const;
  }

  if (selectedEntityType === 'refuel-station') {
    return {
      id: makeEntityId(currentLevel, 'refuel-station'),
      type: 'refuel-station',
      x: worldX,
      y: worldY,
    } as const;
  }

  return {
    id: makeEntityId(currentLevel, 'enemy'),
    type: 'enemy-patroller',
    x: worldX,
    y: worldY,
    pathId: selectedEntityPathId ?? undefined,
  } as const;
}

export function readBackupPreference(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(BACKUP_PREFERENCE_STORAGE_KEY) !== 'false';
}

export function applyRectangleDragToDocument(
  document: EditorDocument,
  rectangleDrag: RectangleDragState,
  context: RectangleDragContext,
): EditorDocument {
  const targetCells = getRectangleTargetCells(rectangleDrag, context.fillRectangleDrag);
  const selectedLayerId = context.selectedLayerId;
  const filteredTargetCells =
    selectedLayerId && context.onlyPaintUnoccupiedCells
      ? targetCells.filter((cell) => !isCellOccupied(document, selectedLayerId, cell.x, cell.y))
      : targetCells;

  if (rectangleDrag.mode === 'tiles') {
    if (!selectedLayerId || !context.selectedTileId || filteredTargetCells.length === 0) {
      return document;
    }

    const nextMaterialPlacements = clearMaterialPlacements(
      document.materialPlacements,
      selectedLayerId,
      filteredTargetCells,
    );
    const refreshedLevel = refreshMaterialPlacementTilesForCells(
      document.level,
      nextMaterialPlacements,
      selectedLayerId,
      filteredTargetCells,
    );

    return {
      level: placeTiles(
        refreshedLevel,
        selectedLayerId,
        context.selectedTileId,
        filteredTargetCells,
      ),
      materialPlacements: nextMaterialPlacements,
    };
  }

  if (rectangleDrag.mode === 'materials') {
    if (!selectedLayerId || !context.selectedMaterialId || filteredTargetCells.length === 0) {
      return document;
    }

    return applyMaterialPlacements(
      document.level,
      document.materialPlacements,
      selectedLayerId,
      context.selectedMaterialId,
      filteredTargetCells,
    );
  }

  return document;
}

export function buildRectanglePreview(
  level: RawShipInteriorLevel,
  materialPlacements: MaterialPlacementMap,
  rectangleDrag: RectangleDragState,
  context: RectangleDragContext,
): EditorCanvasRectanglePreview {
  const targetCells = getRectangleTargetCells(rectangleDrag, context.fillRectangleDrag);
  const tileOverrides: EditorCanvasPreviewTile[] = [];
  const materialCells: EditorCanvasPreviewMaterialCell[] = [];
  const selectedLayerId = context.selectedLayerId;

  if (selectedLayerId) {
    const previewTargetCells = targetCells.filter(
      (cell) =>
        !context.onlyPaintUnoccupiedCells ||
        !isCellOccupied({ level, materialPlacements }, selectedLayerId, cell.x, cell.y),
    );

    if (rectangleDrag.mode === 'tiles' && context.selectedTileId) {
      for (const cell of previewTargetCells) {
        tileOverrides.push({
          layerId: selectedLayerId,
          tileId: context.selectedTileId,
          x: cell.x,
          y: cell.y,
        });
      }

      const layerPlacements = materialPlacements[selectedLayerId] ?? {};
      const nextLayerPlacements = { ...layerPlacements };
      let hadMaterialClears = false;
      for (const cell of previewTargetCells) {
        const key = getMaterialPlacementKey(cell.x, cell.y);
        if (key in nextLayerPlacements) {
          delete nextLayerPlacements[key];
          hadMaterialClears = true;
        }
      }

      if (hadMaterialClears) {
        const nextMaterialPlacements = {
          ...materialPlacements,
          [selectedLayerId]: nextLayerPlacements,
        };
        const affectedCells = getExpandedRectanglePreviewCells(previewTargetCells);
        tileOverrides.push(
          ...resolveMaterialTilesForCells(
            level,
            selectedLayerId,
            nextMaterialPlacements,
            affectedCells,
          ).map((tile) => ({
            layerId: selectedLayerId,
            tileId: tile.tileId,
            x: tile.x,
            y: tile.y,
          })),
        );
      }
    }

    if (rectangleDrag.mode === 'materials' && context.selectedMaterialId) {
      const selectedMaterialId = context.selectedMaterialId;
      const layerPlacements = materialPlacements[selectedLayerId] ?? {};
      const nextMaterialPlacements = {
        ...materialPlacements,
        [selectedLayerId]: {
          ...layerPlacements,
          ...Object.fromEntries(
            previewTargetCells.map((cell) => [
              getMaterialPlacementKey(cell.x, cell.y),
              selectedMaterialId,
            ]),
          ),
        },
      };

      materialCells.push(
        ...previewTargetCells.map((cell) => ({
          material: selectedMaterialId,
          x: cell.x,
          y: cell.y,
        })),
      );
      tileOverrides.push(
        ...resolveMaterialTilesForCells(
          level,
          selectedLayerId,
          nextMaterialPlacements,
          getExpandedRectanglePreviewCells(previewTargetCells),
        ).map((tile) => ({
          layerId: selectedLayerId,
          tileId: tile.tileId,
          x: tile.x,
          y: tile.y,
        })),
      );
    }
  }

  return {
    color:
      rectangleDrag.mode === 'materials'
        ? getMaterialColor(context.selectedMaterialId ?? 'wall')
        : '#facc15',
    startX: rectangleDrag.startX,
    startY: rectangleDrag.startY,
    endX: rectangleDrag.endX,
    endY: rectangleDrag.endY,
    materialCells,
    tileOverrides,
  };
}
