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
import { ToolSwitcher } from './sections/ToolSwitcher';

export function EditorApp() {
  const level = useEditorStore((state) => state.level);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
  const selectedEntityPathId = useEditorStore((state) => state.selectedEntityPathId);
  const selectedEntityType = useEditorStore((state) => state.selectedEntityType);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const setLevel = useEditorStore((state) => state.setLevel);
  const setSelectedEntityId = useEditorStore((state) => state.setSelectedEntityId);
  const setStatus = useEditorStore((state) => state.setStatus);
  const status = useEditorStore((state) => state.status);
  const tool = useEditorStore((state) => state.tool);

  const height = useEditorStore((state) => state.level.height);
  const levelName = useEditorStore((state) => state.level.name);
  const width = useEditorStore((state) => state.level.width);

  const handleSelectInteraction = (worldX: number, worldY: number) => {
    const entity = findNearestEntity(level, worldX, worldY);
    setSelectedEntityId(entity?.id ?? null);
    setStatus(entity ? `Selected ${entity.id}` : 'Selection cleared');
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
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <EditorStoreEffects />

      <aside className="flex w-[23rem] shrink-0 flex-col border-r border-slate-800 bg-slate-950/95">
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
          {tool === 'paths' ? <PathsSection /> : null}
        </div>

        <div className="border-t border-slate-800 px-6 py-4">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</div>
          <div className="mt-2 text-sm text-slate-200">{status}</div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-slate-800 bg-slate-950/70 px-6 py-4">
          <div className="text-sm text-slate-300">
            {tool === 'tiles'
              ? 'Left click to paint the selected tile. Right click to erase from the active layer.'
              : tool === 'entities'
                ? 'Left click to place the selected entity. Right click removes the nearest entity marker.'
                : tool === 'select'
                  ? 'Click an entity to inspect and edit it. Clicking empty space clears the selection.'
                  : 'Path mode is separated in the sidebar. Canvas path editing is the next step.'}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-950 p-6">
          <EditorCanvas
            onPrimaryInteraction={handlePrimaryCanvasInteraction}
            onSecondaryInteraction={handleSecondaryCanvasInteraction}
          />
        </div>
      </main>
    </div>
  );
}
