import { useRef, useState } from 'react';

import {
  EditorCanvas,
  type EditorCanvasPreviewMaterialCell,
  type EditorCanvasPreviewTile,
  type EditorCanvasPointerInfo,
  type EditorCanvasRectanglePreview,
} from './EditorCanvas';
import { getLevelGrid } from '../scenes/ShipInteriorScene/level';
import type { EditorDocument } from './state/history';
import { EditorStoreEffects } from './state/EditorStoreEffects';
import { useEditorStore } from './state/editorStore';
import {
  appendPointToPath,
  cloneLevel,
  eraseTile,
  findPathPointAtPosition,
  findNearestEntity,
  getTilesetForLayer,
  makeEntityId,
  placeTile,
  placeTiles,
  removeEntity,
  removePathPoint,
  updatePathPoint,
  upsertEntity,
} from './shared/levelEditing';
import {
  applyMaterialPlacement,
  applyMaterialPlacements,
  clearMaterialPlacement,
  clearMaterialPlacements,
  getMaterialPlacementKey,
  getMaterialColor,
  refreshMaterialPlacementTilesAround,
  refreshMaterialPlacementTilesForCells,
  resolveMaterialTilesForCells,
} from './shared/materials';
import { EntitiesSection } from './sections/EntitiesSection';
import { LevelSection } from './sections/LevelSection';
import { MaterialsSection } from './sections/MaterialsSection';
import { PathsSection } from './sections/PathsSection';
import { SelectedEntitySection } from './sections/SelectedEntitySection';
import { TilesSection } from './sections/TilesSection';
import { ConfirmationDialog } from '@/ui/components/ConfirmationDialog';
import { Switch } from '@/ui/components/Switch';
import { EditorHeaderMenu } from './components/EditorHeaderMenu';
import { ToolSwitcher } from './components/ToolSwitcher';
import {
  getExpandedRectanglePreviewCells,
  getGridCell,
  getRectangleTargetCells,
  isCellOccupied,
  type RectangleDragContext,
  type RectangleDragState,
} from './utils';

const BACKUP_PREFERENCE_STORAGE_KEY = 'comet-bursters.editor.create-backups';
const COLUMN_ENTITY_SPRITE = '../columnPixelart.png';

function createPlacedEntity(
  currentLevel: ReturnType<typeof useEditorStore.getState>['level'],
  selectedEntityType: ReturnType<typeof useEditorStore.getState>['selectedEntityType'],
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

  return {
    id: makeEntityId(currentLevel, 'enemy'),
    type: 'enemy-patroller',
    x: worldX,
    y: worldY,
    pathId: selectedEntityPathId ?? undefined,
  } as const;
}

function readBackupPreference(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(BACKUP_PREFERENCE_STORAGE_KEY) !== 'false';
}

function applyRectangleDragToDocument(
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
      level: placeTiles(refreshedLevel, selectedLayerId, context.selectedTileId, filteredTargetCells),
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

function buildRectanglePreview(
  level: ReturnType<typeof useEditorStore.getState>['level'],
  materialPlacements: ReturnType<typeof useEditorStore.getState>['materialPlacements'],
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
      rectangleDrag.mode === 'materials' ? getMaterialColor(context.selectedMaterialId ?? 'wall') : '#facc15',
    startX: rectangleDrag.startX,
    startY: rectangleDrag.startY,
    endX: rectangleDrag.endX,
    endY: rectangleDrag.endY,
    materialCells,
    tileOverrides,
  };
}

export function EditorApp() {
  const {
    commitDocumentChange,
    redo,
    resetEditor,
    setDocument,
    setDocumentWithoutHistory,
    setFillRectangleDrag,
    setLevel,
    setOnlyPaintUnoccupiedCells,
    setSelectedEntityId,
    undo,
  } = useEditorStore((state) => state.handlers);
  const canRedo = useEditorStore((state) => state.futureHistory.length > 0);
  const canUndo = useEditorStore((state) => state.pastHistory.length > 0);
  const fillRectangleDrag = useEditorStore((state) => state.fillRectangleDrag);
  const level = useEditorStore((state) => state.level);
  const onlyPaintUnoccupiedCells = useEditorStore((state) => state.onlyPaintUnoccupiedCells);
  const selectedLevelAssetPath = useEditorStore((state) => state.selectedLevelAssetPath);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
  const selectedEntityPathId = useEditorStore((state) => state.selectedEntityPathId);
  const selectedEntityType = useEditorStore((state) => state.selectedEntityType);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const materialPlacements = useEditorStore((state) => state.materialPlacements);
  const selectedMaterialId = useEditorStore((state) => state.selectedMaterialId);
  const selectedPathId = useEditorStore((state) => state.selectedPathId);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const tool = useEditorStore((state) => state.tool);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const draggedEntityIdRef = useRef<string | null>(null);
  const draggedEntityStartDocumentRef = useRef<EditorDocument | null>(null);
  const draggedPathPointRef = useRef<{ pathId: string; pointIndex: number } | null>(null);
  const draggedPathPointStartDocumentRef = useRef<EditorDocument | null>(null);
  const rectangleDragRef = useRef<RectangleDragState | null>(null);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [createBackupsOnSave, setCreateBackupsOnSave] = useState(readBackupPreference);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [rectanglePreview, setRectanglePreview] = useState<EditorCanvasRectanglePreview | null>(
    null,
  );

  const rectangleDragContext: RectangleDragContext = {
    fillRectangleDrag,
    onlyPaintUnoccupiedCells,
    selectedLayerId,
    selectedMaterialId,
    selectedTileId,
  };

  const getLiveDocument = (): EditorDocument => ({
    level,
    materialPlacements,
  });

  const getCurrentDocumentSnapshot = (): EditorDocument => ({
    level: cloneLevel(level),
    materialPlacements: structuredClone(materialPlacements),
  });

  const scrollIntoView = (worldX: number, worldY: number) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) {
      return;
    }
    const viewportPadding = 24;

    viewport.scrollTo({
      left: Math.max(0, worldX * canvasZoom - viewport.clientWidth / 2 + viewportPadding),
      top: Math.max(0, worldY * canvasZoom - viewport.clientHeight / 2 + viewportPadding),
      behavior: 'smooth',
    });
  };

  const updateCanvasZoom = (nextZoom: number) => {
    setCanvasZoom(Math.min(3, Math.max(0.25, nextZoom)));
  };

  const updateCreateBackupsOnSave = (enabled: boolean) => {
    setCreateBackupsOnSave(enabled);
    window.localStorage.setItem(BACKUP_PREFERENCE_STORAGE_KEY, String(enabled));
  };

  const handleSave = async () => {
    if (!selectedLevelAssetPath) {
      alert('Only bundled levels from assets/levels can be saved to disk.');
      return;
    }

    const fileName = selectedLevelAssetPath.split('/').pop();
    if (!fileName) {
      alert('Could not resolve the target level file name.');
      return;
    }

    try {
      const response = await fetch('/__editor/save-level', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createBackup: createBackupsOnSave,
          fileName,
          level,
          materialPlacements,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error ?? 'Failed to save level');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save level');
    }
  };

  const handleEntityPlacementPreviewStart = (worldX: number, worldY: number) => {
    draggedEntityStartDocumentRef.current = getCurrentDocumentSnapshot();
    setDocumentWithoutHistory((currentDocument) => {
      const entity = createPlacedEntity(
        currentDocument.level,
        selectedEntityType,
        selectedEntityPathId,
        worldX,
        worldY,
      );
      draggedEntityIdRef.current = entity.id;
      setSelectedEntityId(entity.id);
      return {
        ...currentDocument,
        level: upsertEntity(currentDocument.level, entity),
      };
    });
  };

  const handleEntityRemoval = (worldX: number, worldY: number) => {
    setLevel((currentLevel) => {
      const entity = findNearestEntity(currentLevel, worldX, worldY);
      return entity ? removeEntity(currentLevel, entity.id) : currentLevel;
    });
  };

  const handleTilePaint = (worldX: number, worldY: number) => {
    const selectedTileset = getTilesetForLayer(level, selectedLayerId);
    if (!selectedLayerId || !selectedTileset || !selectedTileId) {
      return;
    }

    const levelGrid = getLevelGrid(level);
    const x = Math.floor(worldX / levelGrid.cellWidth);
    const y = Math.floor(worldY / levelGrid.cellHeight);
    const isOccupied =
      level.layers
        .find((layer) => layer.id === selectedLayerId)
        ?.tiles.some((tile) => tile.x === x && tile.y === y) ||
      Boolean(materialPlacements[selectedLayerId]?.[`${x},${y}`]);
    if (onlyPaintUnoccupiedCells && isOccupied) {
      return;
    }
    const nextMaterialPlacements = clearMaterialPlacement(
      materialPlacements,
      selectedLayerId,
      x,
      y,
    );
    const refreshedLevel = refreshMaterialPlacementTilesAround(
      level,
      nextMaterialPlacements,
      selectedLayerId,
      x,
      y,
    );
    setDocument({
      level: placeTile(refreshedLevel, selectedLayerId, selectedTileId, x, y),
      materialPlacements: nextMaterialPlacements,
    });
  };

  const handleTileErase = (worldX: number, worldY: number) => {
    const selectedTileset = getTilesetForLayer(level, selectedLayerId);
    if (!selectedLayerId || !selectedTileset) {
      return;
    }

    const levelGrid = getLevelGrid(level);
    const x = Math.floor(worldX / levelGrid.cellWidth);
    const y = Math.floor(worldY / levelGrid.cellHeight);
    const nextMaterialPlacements = clearMaterialPlacement(
      materialPlacements,
      selectedLayerId,
      x,
      y,
    );
    const refreshedLevel = refreshMaterialPlacementTilesAround(
      level,
      nextMaterialPlacements,
      selectedLayerId,
      x,
      y,
    );
    setDocument({
      level: eraseTile(refreshedLevel, selectedLayerId, x, y),
      materialPlacements: nextMaterialPlacements,
    });
  };

  const handleMaterialPaint = (worldX: number, worldY: number) => {
    const levelGrid = getLevelGrid(level);
    const x = Math.floor(worldX / levelGrid.cellWidth);
    const y = Math.floor(worldY / levelGrid.cellHeight);
    if (!selectedLayerId || !selectedMaterialId) {
      return;
    }
    const isOccupied =
      level.layers
        .find((layer) => layer.id === selectedLayerId)
        ?.tiles.some((tile) => tile.x === x && tile.y === y) ||
      Boolean(materialPlacements[selectedLayerId]?.[`${x},${y}`]);
    if (onlyPaintUnoccupiedCells && isOccupied) {
      return;
    }

    const result = applyMaterialPlacement(
      level,
      materialPlacements,
      selectedLayerId,
      selectedMaterialId,
      x,
      y,
    );
    setDocument({
      level: result.level,
      materialPlacements: result.materialPlacements,
    });
  };

  const handleRectanglePreviewStart = (mode: RectangleDragState['mode'], worldX: number, worldY: number) => {
    const { x, y } = getGridCell(level, worldX, worldY);
    const nextRectangleDrag = {
      mode,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
    };
    rectangleDragRef.current = nextRectangleDrag;
    setRectanglePreview(
      buildRectanglePreview(level, materialPlacements, nextRectangleDrag, rectangleDragContext),
    );
  };

  const handleRectanglePreviewMove = (worldX: number, worldY: number) => {
    const rectangleDrag = rectangleDragRef.current;
    if (!rectangleDrag) {
      return false;
    }

    const { x, y } = getGridCell(level, worldX, worldY);
    rectangleDrag.endX = x;
    rectangleDrag.endY = y;
    setRectanglePreview(
      buildRectanglePreview(level, materialPlacements, rectangleDrag, rectangleDragContext),
    );
    return true;
  };

  const handleRectanglePreviewCommit = () => {
    const rectangleDrag = rectangleDragRef.current;
    if (!rectangleDrag) {
      return;
    }

    const nextDocument = applyRectangleDragToDocument(
      getLiveDocument(),
      rectangleDrag,
      rectangleDragContext,
    );
    setDocument(nextDocument);

    rectangleDragRef.current = null;
    setRectanglePreview(null);
  };

  const clearRectanglePreview = () => {
    rectangleDragRef.current = null;
    setRectanglePreview(null);
  };

  const handleTileDrag = (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => {
    if (handleRectanglePreviewMove(worldX, worldY)) {
      return;
    }

    if ((info.buttons & 2) === 2) {
      handleTileErase(worldX, worldY);
      return;
    }

    if ((info.buttons & 1) === 1) {
      handleTilePaint(worldX, worldY);
    }
  };

  const handleMaterialDrag = (worldX: number, worldY: number, info: EditorCanvasPointerInfo) => {
    if (handleRectanglePreviewMove(worldX, worldY)) {
      return;
    }

    if ((info.buttons & 2) === 2) {
      handleTileErase(worldX, worldY);
      return;
    }

    if ((info.buttons & 1) === 1) {
      handleMaterialPaint(worldX, worldY);
    }
  };

  const handlePathPointerDown = (worldX: number, worldY: number) => {
    if (!selectedPathId) {
      return;
    }

    const hitPoint = findPathPointAtPosition(level, selectedPathId, worldX, worldY);
    if (hitPoint) {
      draggedPathPointRef.current = { pathId: selectedPathId, pointIndex: hitPoint.index };
      draggedPathPointStartDocumentRef.current = getCurrentDocumentSnapshot();
      return;
    }

    setLevel((currentLevel) =>
      appendPointToPath(currentLevel, selectedPathId, Math.round(worldX), Math.round(worldY)),
    );
  };

  const handlePathPointerMove = (worldX: number, worldY: number) => {
    const draggedPoint = draggedPathPointRef.current;
    if (!draggedPoint) {
      return;
    }

    setDocumentWithoutHistory((currentDocument) => ({
      ...currentDocument,
      level: updatePathPoint(
        currentDocument.level,
        draggedPoint.pathId,
        draggedPoint.pointIndex,
        Math.round(worldX),
        Math.round(worldY),
      ),
    }));
  };

  const handlePathPointerUp = (worldX: number, worldY: number) => {
    const draggedPoint = draggedPathPointRef.current;
    if (!draggedPoint) {
      return;
    }

    setDocumentWithoutHistory((currentDocument) => ({
      ...currentDocument,
      level: updatePathPoint(
        currentDocument.level,
        draggedPoint.pathId,
        draggedPoint.pointIndex,
        Math.round(worldX),
        Math.round(worldY),
      ),
    }));
    if (draggedPathPointStartDocumentRef.current) {
      commitDocumentChange(draggedPathPointStartDocumentRef.current);
    }
    draggedPathPointRef.current = null;
    draggedPathPointStartDocumentRef.current = null;
  };

  const handleEntityPointerDown = (worldX: number, worldY: number, shouldSelect: boolean) => {
    const entity = findNearestEntity(level, worldX, worldY);
    if (!entity) {
      if (shouldSelect) {
        setSelectedEntityId(null);
      }
      return false;
    }

    draggedEntityIdRef.current = entity.id;
    draggedEntityStartDocumentRef.current = getCurrentDocumentSnapshot();
    if (shouldSelect) {
      setSelectedEntityId(entity.id);
    }
    return true;
  };

  const handleEntityPointerMove = (worldX: number, worldY: number) => {
    const draggedEntityId = draggedEntityIdRef.current;
    if (!draggedEntityId) {
      return;
    }

    setDocumentWithoutHistory((currentDocument) => {
      const entity = currentDocument.level.entities.find(
        (candidate) => candidate.id === draggedEntityId,
      );
      if (!entity) {
        return currentDocument;
      }

      return {
        ...currentDocument,
        level: upsertEntity(currentDocument.level, {
          ...entity,
          x: Math.round(worldX),
          y: Math.round(worldY),
        }),
      };
    });
  };

  const handleEntityPointerUp = (worldX: number, worldY: number) => {
    handleEntityPointerMove(worldX, worldY);
    if (draggedEntityStartDocumentRef.current) {
      commitDocumentChange(draggedEntityStartDocumentRef.current);
    }
    draggedEntityIdRef.current = null;
    draggedEntityStartDocumentRef.current = null;
  };

  const handlePrimaryCanvasInteraction = (
    worldX: number,
    worldY: number,
    info: EditorCanvasPointerInfo,
  ) => {
    if (tool === 'select') {
      handleEntityPointerDown(worldX, worldY, true);
      return;
    }
    if (tool === 'entities') {
      if (handleEntityPointerDown(worldX, worldY, false)) {
        return;
      }
      if ((info.buttons & 1) === 1) {
        handleEntityPlacementPreviewStart(worldX, worldY);
      }
      return;
    }
    if (tool === 'tiles') {
      if ((info.buttons & 1) === 1) {
        if (info.shiftKey) {
          handleRectanglePreviewStart('tiles', worldX, worldY);
          return;
        }
        handleTilePaint(worldX, worldY);
      }
      return;
    }
    if (tool === 'materials') {
      if ((info.buttons & 1) === 1) {
        if (info.shiftKey) {
          handleRectanglePreviewStart('materials', worldX, worldY);
          return;
        }
        handleMaterialPaint(worldX, worldY);
      }
      return;
    }
    if (tool === 'paths') {
      handlePathPointerDown(worldX, worldY);
    }
  };

  const handleCanvasPointerMove = (
    worldX: number,
    worldY: number,
    info: EditorCanvasPointerInfo,
  ) => {
    if (tool === 'select' || tool === 'entities') {
      handleEntityPointerMove(worldX, worldY);
      return;
    }
    if (tool === 'tiles') {
      handleTileDrag(worldX, worldY, info);
      return;
    }
    if (tool === 'materials') {
      handleMaterialDrag(worldX, worldY, info);
      return;
    }
    if (tool === 'paths') {
      handlePathPointerMove(worldX, worldY);
    }
  };

  const handleCanvasPointerUp = (worldX: number, worldY: number) => {
    if (tool === 'select' || tool === 'entities') {
      handleEntityPointerUp(worldX, worldY);
      return;
    }
    if (tool === 'tiles' || tool === 'materials') {
      if (rectangleDragRef.current) {
        handleRectanglePreviewMove(worldX, worldY);
        handleRectanglePreviewCommit();
      }
      return;
    }
    if (tool === 'paths') {
      handlePathPointerUp(worldX, worldY);
    }
  };

  const handleSecondaryCanvasInteraction = (worldX: number, worldY: number) => {
    if (tool === 'entities') {
      draggedEntityIdRef.current = null;
      draggedEntityStartDocumentRef.current = null;
      clearRectanglePreview();
      handleEntityRemoval(worldX, worldY);
      return;
    }
    if (tool === 'tiles') {
      clearRectanglePreview();
      handleTileErase(worldX, worldY);
      return;
    }
    if (tool === 'materials') {
      clearRectanglePreview();
      handleTileErase(worldX, worldY);
      return;
    }
    if (tool === 'paths' && selectedPathId) {
      const hitPoint = findPathPointAtPosition(level, selectedPathId, worldX, worldY);
      if (!hitPoint) {
        return;
      }

      draggedPathPointRef.current = null;
      draggedPathPointStartDocumentRef.current = null;
      setLevel((currentLevel) => removePathPoint(currentLevel, selectedPathId, hitPoint.index));
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <EditorStoreEffects />

      <aside className="flex h-full w-92 shrink-0 flex-col border-r border-slate-800 bg-slate-950/95">
        <div className="border-b border-slate-800 px-6 py-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <a
              href="/"
              className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Back Home
            </a>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:border-slate-500 hover:text-white not-disabled:cursor-pointer disabled:opacity-40"
                aria-label="Undo"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 6 4 10l4 4" />
                  <path d="M5 10h6a5 5 0 1 1 0 10" />
                </svg>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:border-slate-500 hover:text-white not-disabled:cursor-pointer disabled:opacity-40"
                aria-label="Redo"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12 6 4 4-4 4" />
                  <path d="M15 10H9a5 5 0 1 0 0 10" />
                </svg>
              </button>
              <EditorHeaderMenu
                createBackupsOnSave={createBackupsOnSave}
                isOpen={isHeaderMenuOpen}
                onClose={() => setIsHeaderMenuOpen(false)}
                onReset={() => {
                  setIsHeaderMenuOpen(false);
                  setIsResetModalOpen(true);
                }}
                onSave={() => {
                  setIsHeaderMenuOpen(false);
                  void handleSave();
                }}
                onToggle={() => setIsHeaderMenuOpen((current) => !current)}
                onToggleCreateBackups={() => updateCreateBackupsOnSave(!createBackupsOnSave)}
              />
            </div>
          </div>
          <LevelSection zoom={canvasZoom} onCanvasZoomChange={updateCanvasZoom} />
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <ToolSwitcher />
          {tool === 'tiles' || tool === 'materials' ? (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      Empty Cell Paint
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Skip tiles or materials that already occupy the target cell.
                    </div>
                  </div>
                  <Switch
                    checked={onlyPaintUnoccupiedCells}
                    onCheckedChange={setOnlyPaintUnoccupiedCells}
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      Filled Rectangle Paint
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Shift-drag paints the entire rectangle area instead of only the border.
                    </div>
                  </div>
                  <Switch checked={fillRectangleDrag} onCheckedChange={setFillRectangleDrag} />
                </div>
              </div>
            </>
          ) : null}

          {tool === 'select' && selectedEntityId ? <SelectedEntitySection /> : null}
          {tool === 'tiles' || tool === 'materials' ? (
            <TilesSection showPalette={tool === 'tiles'} />
          ) : null}
          {tool === 'materials' ? <MaterialsSection /> : null}
          {tool === 'entities' ? <EntitiesSection /> : null}
          {tool === 'paths' ? <PathsSection onScrollIntoView={scrollIntoView} /> : null}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div ref={canvasViewportRef} className="min-h-0 flex-1 overflow-auto bg-slate-950 p-6">
          <EditorCanvas
            onPointerDown={handlePrimaryCanvasInteraction}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onSecondaryInteraction={handleSecondaryCanvasInteraction}
            rectanglePreview={rectanglePreview}
            zoom={canvasZoom}
          />
        </div>
      </main>

      <ConfirmationDialog
        isOpen={isResetModalOpen}
        title="Reset editor state?"
        message="This will clear the current editor session, including the persisted local changes and undo history."
        confirmLabel="Reset"
        onCancel={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          resetEditor();
          setIsResetModalOpen(false);
          setIsHeaderMenuOpen(false);
        }}
      />
    </div>
  );
}
