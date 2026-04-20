import { useRef } from 'react';

import { EditorCanvas } from '../canvas/EditorCanvas';
import { EditorStoreEffects } from '../state/EditorStoreEffects';
import { useEditorStore } from '../state/editorStore';
import {
  appendPointToPath,
  eraseTile,
  findPathPointAtPosition,
  findNearestEntity,
  getTilesetForLayer,
  makeEntityId,
  placeTile,
  removeEntity,
  removePathPoint,
  updatePathPoint,
  upsertEntity,
} from '../shared/levelEditing';
import { EntitiesSection } from './sections/EntitiesSection';
import { LevelSection } from './sections/LevelSection';
import { PathsSection } from './sections/PathsSection';
import { SelectedEntitySection } from './sections/SelectedEntitySection';
import { TilesSection } from './sections/TilesSection';
import { ToolSwitcher } from './components/ToolSwitcher';

export function EditorApp() {
  const canRedo = useEditorStore((state) => state.futureLevels.length > 0);
  const canUndo = useEditorStore((state) => state.pastLevels.length > 0);
  const level = useEditorStore((state) => state.level);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
  const selectedEntityPathId = useEditorStore((state) => state.selectedEntityPathId);
  const selectedEntityType = useEditorStore((state) => state.selectedEntityType);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedPathId = useEditorStore((state) => state.selectedPathId);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const setLevel = useEditorStore((state) => state.setLevel);
  const setSelectedEntityId = useEditorStore((state) => state.setSelectedEntityId);
  const tool = useEditorStore((state) => state.tool);
  const redo = useEditorStore((state) => state.redo);
  const undo = useEditorStore((state) => state.undo);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const draggedEntityIdRef = useRef<string | null>(null);
  const draggedPathPointRef = useRef<{ pathId: string; pointIndex: number } | null>(null);

  const height = useEditorStore((state) => state.level.height);
  const levelName = useEditorStore((state) => state.level.name);
  const width = useEditorStore((state) => state.level.width);

  const scrollIntoView = (worldX: number, worldY: number) => {
    const viewport = canvasViewportRef.current;
    if (!viewport) {
      return;
    }
    const viewportPadding = 24;

    viewport.scrollTo({
      left: Math.max(0, worldX - viewport.clientWidth / 2 + viewportPadding),
      top: Math.max(0, worldY - viewport.clientHeight / 2 + viewportPadding),
      behavior: 'smooth',
    });
  };

  const handleEntityPlacement = (worldX: number, worldY: number) => {
    setLevel((currentLevel) => {
      if (selectedEntityType === 'player') {
        const withoutPlayer = currentLevel.entities.filter((entity) => entity.type !== 'player');
        return {
          ...currentLevel,
          entities: [...withoutPlayer, { id: 'player', type: 'player', x: worldX, y: worldY }],
        };
      }

      return upsertEntity(currentLevel, {
        id: makeEntityId(currentLevel, 'enemy'),
        type: 'enemy-patroller',
        x: worldX,
        y: worldY,
        pathId: selectedEntityPathId ?? undefined,
      });
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

    const x = Math.floor(worldX / selectedTileset.grid.frameWidth);
    const y = Math.floor(worldY / selectedTileset.grid.frameHeight);
    setLevel((currentLevel) => placeTile(currentLevel, selectedLayerId, selectedTileId, x, y));
  };

  const handleTileErase = (worldX: number, worldY: number) => {
    const selectedTileset = getTilesetForLayer(level, selectedLayerId);
    if (!selectedLayerId || !selectedTileset) {
      return;
    }

    const x = Math.floor(worldX / selectedTileset.grid.frameWidth);
    const y = Math.floor(worldY / selectedTileset.grid.frameHeight);
    setLevel((currentLevel) => eraseTile(currentLevel, selectedLayerId, x, y));
  };

  const handlePathPointerDown = (worldX: number, worldY: number) => {
    if (!selectedPathId) {
      return;
    }

    const hitPoint = findPathPointAtPosition(level, selectedPathId, worldX, worldY);
    if (hitPoint) {
      draggedPathPointRef.current = { pathId: selectedPathId, pointIndex: hitPoint.index };
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

    setLevel((currentLevel) =>
      updatePathPoint(
        currentLevel,
        draggedPoint.pathId,
        draggedPoint.pointIndex,
        Math.round(worldX),
        Math.round(worldY),
      ),
    );
  };

  const handlePathPointerUp = (worldX: number, worldY: number) => {
    const draggedPoint = draggedPathPointRef.current;
    if (!draggedPoint) {
      return;
    }

    setLevel((currentLevel) =>
      updatePathPoint(
        currentLevel,
        draggedPoint.pathId,
        draggedPoint.pointIndex,
        Math.round(worldX),
        Math.round(worldY),
      ),
    );
    draggedPathPointRef.current = null;
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

    setLevel((currentLevel) => {
      const entity = currentLevel.entities.find((candidate) => candidate.id === draggedEntityId);
      if (!entity) {
        return currentLevel;
      }

      return upsertEntity(currentLevel, {
        ...entity,
        x: Math.round(worldX),
        y: Math.round(worldY),
      });
    });
  };

  const handleEntityPointerUp = (worldX: number, worldY: number) => {
    handleEntityPointerMove(worldX, worldY);
    draggedEntityIdRef.current = null;
  };

  const handlePrimaryCanvasInteraction = (worldX: number, worldY: number) => {
    if (tool === 'select') {
      handleEntityPointerDown(worldX, worldY, true);
      return;
    }
    if (tool === 'entities') {
      if (handleEntityPointerDown(worldX, worldY, false)) {
        return;
      }
      handleEntityPlacement(worldX, worldY);
      return;
    }
    if (tool === 'tiles') {
      handleTilePaint(worldX, worldY);
      return;
    }
    if (tool === 'paths') {
      handlePathPointerDown(worldX, worldY);
    }
  };

  const handleCanvasPointerMove = (worldX: number, worldY: number) => {
    if (tool === 'select' || tool === 'entities') {
      handleEntityPointerMove(worldX, worldY);
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
    if (tool === 'paths') {
      handlePathPointerUp(worldX, worldY);
    }
  };

  const handleSecondaryCanvasInteraction = (worldX: number, worldY: number) => {
    if (tool === 'entities') {
      draggedEntityIdRef.current = null;
      handleEntityRemoval(worldX, worldY);
      return;
    }
    if (tool === 'tiles') {
      handleTileErase(worldX, worldY);
      return;
    }
    if (tool === 'paths' && selectedPathId) {
      const hitPoint = findPathPointAtPosition(level, selectedPathId, worldX, worldY);
      if (!hitPoint) {
        return;
      }

      draggedPathPointRef.current = null;
      setLevel((currentLevel) => removePathPoint(currentLevel, selectedPathId, hitPoint.index));
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <EditorStoreEffects />

      <aside className="flex h-full w-92 shrink-0 flex-col border-r border-slate-800 bg-slate-950/95">
        <div className="border-b border-slate-800 px-6 py-5">
          <div className="mb-4 flex items-center gap-2">
            <a
              href="/"
              className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Back Home
            </a>
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
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            {levelName}
            <div className="mt-1 text-xs text-slate-500">
              {width} x {height}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <ToolSwitcher />
          <LevelSection />

          {tool === 'select' && selectedEntityId ? <SelectedEntitySection /> : null}
          {tool === 'tiles' ? <TilesSection /> : null}
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
          />
        </div>
      </main>
    </div>
  );
}
