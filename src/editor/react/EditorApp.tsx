import { useRef } from 'react';

import { EditorCanvas } from '../canvas/EditorCanvas';
import { EditorStoreEffects } from '../state/EditorStoreEffects';
import { useEditorStore } from '../state/editorStore';
import {
  eraseTile,
  findNearestEntity,
  getTilesetForLayer,
  makeEntityId,
  placeTile,
  removeEntity,
  upsertEntity,
} from '../shared/levelEditing';
import { EntitiesSection } from './sections/EntitiesSection';
import { LevelSection } from './sections/LevelSection';
import { PathsSection } from './sections/PathsSection';
import { SelectedEntitySection } from './sections/SelectedEntitySection';
import { TilesSection } from './sections/TilesSection';
import { ToolSwitcher } from './components/ToolSwitcher';

export function EditorApp() {
  const level = useEditorStore((state) => state.level);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
  const selectedEntityPathId = useEditorStore((state) => state.selectedEntityPathId);
  const selectedEntityType = useEditorStore((state) => state.selectedEntityType);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const setLevel = useEditorStore((state) => state.setLevel);
  const setSelectedEntityId = useEditorStore((state) => state.setSelectedEntityId);
  const tool = useEditorStore((state) => state.tool);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

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

  const handleSelectInteraction = (worldX: number, worldY: number) => {
    const entity = findNearestEntity(level, worldX, worldY);
    setSelectedEntityId(entity?.id ?? null);
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

  const handlePrimaryCanvasInteraction = (worldX: number, worldY: number) => {
    if (tool === 'select') {
      handleSelectInteraction(worldX, worldY);
      return;
    }
    if (tool === 'entities') {
      handleEntityPlacement(worldX, worldY);
      return;
    }
    if (tool === 'tiles') {
      handleTilePaint(worldX, worldY);
      return;
    }
  };

  const handleSecondaryCanvasInteraction = (worldX: number, worldY: number) => {
    if (tool === 'select') {
      handleSelectInteraction(worldX, worldY);
      return;
    }
    if (tool === 'entities') {
      handleEntityRemoval(worldX, worldY);
      return;
    }
    if (tool === 'tiles') {
      handleTileErase(worldX, worldY);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <EditorStoreEffects />

      <aside className="flex h-full w-92 shrink-0 flex-col border-r border-slate-800 bg-slate-950/95">
        <div className="border-b border-slate-800 px-6 py-5">
          <a
            href="/"
            className="inline-flex rounded-full border border-slate-700 mb-4 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Back Home
          </a>
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
            onPrimaryInteraction={handlePrimaryCanvasInteraction}
            onSecondaryInteraction={handleSecondaryCanvasInteraction}
          />
        </div>
      </main>
    </div>
  );
}
