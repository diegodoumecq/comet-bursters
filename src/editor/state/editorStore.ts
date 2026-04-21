import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import defaultLevel from '../../assets/levels/shipInterior.level.json';
import type {
  RawShipInteriorLevel,
  ShipInteriorEntityDefinition,
} from '../../scenes/ShipInteriorScene/level';
import type { AssetUrlMap, EditorTool, ImageMap, PlaceableEntityType } from '../shared/editorTypes';
import { bundledLevels, hydrateLevelTilesets } from '../shared/levelCatalog';
import {
  cloneLevel,
  getTilesetForLayer,
  removeEntity,
  upsertEntity,
} from '../shared/levelEditing';

type EditorState = {
  assetPathInput: string;
  assetUrls: AssetUrlMap;
  futureLevels: RawShipInteriorLevel[];
  images: ImageMap;
  layerVisibility: Record<string, boolean>;
  inactiveLayerOpacity: number;
  level: RawShipInteriorLevel;
  openPathMenuId: string | null;
  pastLevels: RawShipInteriorLevel[];
  renamingPathId: string | null;
  renamingPathValue: string;
  selectedLevelAssetPath: string | null;
  selectedEntityId: string | null;
  selectedEntityPathId: string | null;
  selectedEntityType: PlaceableEntityType;
  selectedLayerId: string | null;
  selectedPathId: string | null;
  selectedTileId: string | null;
  tool: EditorTool;
};

type EditorActions = {
  applyAssetPath: () => void;
  deletePath: (pathId: string) => void;
  deleteSelectedEntity: () => void;
  importLevelFromText: (text: string, fileName: string) => void;
  loadBundledLevel: (assetPath: string) => void;
  pickTilesetPng: (file: File) => void;
  redo: () => void;
  resetEditor: () => void;
  savePathRename: (pathId: string) => void;
  setAssetPathInput: (value: string) => void;
  setImages: (images: ImageMap) => void;
  setInactiveLayerOpacity: (opacity: number) => void;
  setLayerVisibility: (layerId: string, isVisible: boolean) => void;
  setLevel: (
    updater: RawShipInteriorLevel | ((currentLevel: RawShipInteriorLevel) => RawShipInteriorLevel),
  ) => void;
  setLevelWithoutHistory: (
    updater: RawShipInteriorLevel | ((currentLevel: RawShipInteriorLevel) => RawShipInteriorLevel),
  ) => void;
  commitLevelChange: (previousLevel: RawShipInteriorLevel) => void;
  setOpenPathMenuId: (pathId: string | null) => void;
  setRenamingPathId: (pathId: string | null) => void;
  setRenamingPathValue: (value: string) => void;
  setSelectedEntityId: (entityId: string | null) => void;
  setSelectedEntityPathId: (pathId: string | null) => void;
  setSelectedEntityType: (entityType: PlaceableEntityType) => void;
  setSelectedLayerId: (layerId: string | null) => void;
  setSelectedPathId: (pathId: string | null) => void;
  setSelectedTileId: (tileId: string | null) => void;
  setTool: (tool: EditorTool) => void;
  syncDerivedState: () => void;
  undo: () => void;
  updateSelectedEntity: (updates: Partial<ShipInteriorEntityDefinition>) => void;
  updateSelectedEntityType: (nextType: PlaceableEntityType) => void;
};

type EditorStore = EditorState & EditorActions;

const initialLevel = hydrateLevelTilesets(defaultLevel as unknown as RawShipInteriorLevel);
const HISTORY_LIMIT = 100;
const EDITOR_STORAGE_KEY = 'comet-bursters.editor';
const initialSelectedLevelAssetPath =
  bundledLevels.find((entry) => entry.level.name === initialLevel.name)?.assetPath ?? null;

function buildLevelResetState(
  level: RawShipInteriorLevel,
  selectedLevelAssetPath: string | null,
): Partial<EditorState> {
  return {
    assetPathInput: '',
    futureLevels: [],
    layerVisibility: {},
    inactiveLayerOpacity: 0.35,
    level,
    openPathMenuId: null,
    pastLevels: [],
    renamingPathId: null,
    renamingPathValue: '',
    selectedEntityId: null,
    selectedEntityPathId: null,
    selectedLayerId: level.layers[0]?.id ?? null,
    selectedLevelAssetPath,
    selectedPathId: null,
    selectedTileId: null,
    tool: 'select',
  };
}

function buildInitialEditorState(): EditorState {
  return {
    assetPathInput: '',
    assetUrls: {},
    futureLevels: [],
    images: {},
    layerVisibility: {},
    inactiveLayerOpacity: 0.35,
    level: cloneLevel(initialLevel),
    openPathMenuId: null,
    pastLevels: [],
    renamingPathId: null,
    renamingPathValue: '',
    selectedLevelAssetPath: initialSelectedLevelAssetPath,
    selectedEntityId: null,
    selectedEntityPathId: null,
    selectedEntityType: 'enemy-patroller',
    selectedLayerId: initialLevel.layers[0]?.id ?? null,
    selectedPathId: null,
    selectedTileId: null,
    tool: 'select',
  };
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      ...buildInitialEditorState(),

      applyAssetPath: () => {
        const { assetPathInput, level, selectedLayerId } = get();
        const selectedTileset = getTilesetForLayer(level, selectedLayerId);
        if (!selectedTileset || !assetPathInput.trim()) {
          return;
        }

        set((state) => ({
          level: {
            ...state.level,
            tilesets: state.level.tilesets.map((tileset) =>
              tileset.id === selectedTileset.id
                ? { ...tileset, imageSrc: assetPathInput.trim() }
                : tileset,
            ),
          },
        }));
      },

      deletePath: (pathId) => {
        set((state) => ({
          level: {
            ...state.level,
            paths: state.level.paths.filter((path) => path.id !== pathId),
            entities: state.level.entities.map((entity) =>
              entity.pathId === pathId ? { ...entity, pathId: undefined } : entity,
            ),
          },
          openPathMenuId: null,
          renamingPathId: state.renamingPathId === pathId ? null : state.renamingPathId,
          renamingPathValue: state.renamingPathId === pathId ? '' : state.renamingPathValue,
          selectedEntityPathId:
            state.selectedEntityPathId === pathId ? null : state.selectedEntityPathId,
          selectedPathId: state.selectedPathId === pathId ? null : state.selectedPathId,
        }));
      },

      deleteSelectedEntity: () => {
        const { selectedEntityId } = get();
        if (!selectedEntityId) {
          return;
        }

        set((state) => ({
          level: removeEntity(state.level, selectedEntityId),
          selectedEntityId: null,
        }));
      },

      importLevelFromText: (text, fileName) => {
        try {
          const parsed = hydrateLevelTilesets(JSON.parse(text) as RawShipInteriorLevel);
          set(buildLevelResetState(parsed, null));
          get().syncDerivedState();
        } catch (error) {
          alert('Failed to import JSON ' + fileName);
        }
      },

      loadBundledLevel: (assetPath) => {
        const entry = bundledLevels.find((candidate) => candidate.assetPath === assetPath);
        if (!entry) {
          alert(`Unknown level asset: ${assetPath}`);
          return;
        }

        set(buildLevelResetState(cloneLevel(entry.level), assetPath));
        get().syncDerivedState();
      },

      pickTilesetPng: (file) => {
        const { level, selectedLayerId } = get();
        const selectedTileset = getTilesetForLayer(level, selectedLayerId);
        if (!selectedTileset) {
          return;
        }

        const objectUrl = URL.createObjectURL(file);
        set((state) => {
          const previousUrl = state.assetUrls[selectedTileset.id];
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          return {
            assetUrls: { ...state.assetUrls, [selectedTileset.id]: objectUrl },
          };
        });
      },

      redo: () => {
        const { futureLevels, level } = get();
        const nextLevel = futureLevels[0];
        if (!nextLevel) {
          return;
        }

        set((state) => ({
          futureLevels: state.futureLevels.slice(1),
          level: cloneLevel(nextLevel),
          pastLevels: [cloneLevel(level), ...state.pastLevels].slice(0, HISTORY_LIMIT),
        }));
        get().syncDerivedState();
      },

      resetEditor: () => {
        set(buildInitialEditorState());
      },

      savePathRename: (pathId) => {
        const { level, renamingPathValue, selectedEntityPathId } = get();
        const nextId = renamingPathValue.trim();
        if (!nextId) {
          alert('Path name cannot be empty');
          return;
        }
        if (nextId === pathId) {
          set({ renamingPathId: null, renamingPathValue: '' });
          return;
        }
        if (level.paths.some((path) => path.id === nextId)) {
          alert(`Path "${nextId}" already exists`);
          return;
        }

        set((state) => ({
          level: {
            ...state.level,
            paths: state.level.paths.map((path) =>
              path.id === pathId ? { ...path, id: nextId } : path,
            ),
            entities: state.level.entities.map((entity) =>
              entity.pathId === pathId ? { ...entity, pathId: nextId } : entity,
            ),
          },
          openPathMenuId: null,
          renamingPathId: null,
          renamingPathValue: '',
          selectedEntityPathId: selectedEntityPathId === pathId ? nextId : selectedEntityPathId,
          selectedPathId: state.selectedPathId === pathId ? nextId : state.selectedPathId,
        }));
      },

      setAssetPathInput: (assetPathInput) => set({ assetPathInput }),
      setImages: (images) => set({ images }),
      setInactiveLayerOpacity: (inactiveLayerOpacity) =>
        set({ inactiveLayerOpacity: Math.min(1, Math.max(0, inactiveLayerOpacity)) }),
      setLayerVisibility: (layerId, isVisible) =>
        set((state) => ({
          layerVisibility: {
            ...state.layerVisibility,
            [layerId]: isVisible,
          },
        })),
      setLevel: (updater) =>
        set((state) => {
          const nextLevel = typeof updater === 'function' ? updater(state.level) : updater;
          const currentSnapshot = JSON.stringify(state.level);
          const nextSnapshot = JSON.stringify(nextLevel);
          if (currentSnapshot === nextSnapshot) {
            return {};
          }

          const pastLevels = [cloneLevel(state.level), ...state.pastLevels].slice(0, HISTORY_LIMIT);
          return {
            futureLevels: [],
            level: nextLevel,
            pastLevels,
          };
        }),
      setLevelWithoutHistory: (updater) =>
        set((state) => {
          const nextLevel = typeof updater === 'function' ? updater(state.level) : updater;
          const currentSnapshot = JSON.stringify(state.level);
          const nextSnapshot = JSON.stringify(nextLevel);
          if (currentSnapshot === nextSnapshot) {
            return {};
          }

          return {
            level: nextLevel,
          };
        }),
      commitLevelChange: (previousLevel) =>
        set((state) => {
          const previousSnapshot = JSON.stringify(previousLevel);
          const currentSnapshot = JSON.stringify(state.level);
          if (previousSnapshot === currentSnapshot) {
            return {};
          }

          return {
            futureLevels: [],
            pastLevels: [cloneLevel(previousLevel), ...state.pastLevels].slice(0, HISTORY_LIMIT),
          };
        }),
      setOpenPathMenuId: (openPathMenuId) => set({ openPathMenuId }),
      setRenamingPathId: (renamingPathId) => set({ renamingPathId }),
      setRenamingPathValue: (renamingPathValue) => set({ renamingPathValue }),
      setSelectedEntityId: (selectedEntityId) => set({ selectedEntityId }),
      setSelectedEntityPathId: (selectedEntityPathId) => set({ selectedEntityPathId }),
      setSelectedEntityType: (selectedEntityType) => set({ selectedEntityType }),
      setSelectedLayerId: (selectedLayerId) =>
        set((state) => {
          const selectedTileset = getTilesetForLayer(state.level, selectedLayerId);
          if (!selectedTileset) {
            return {
              selectedLayerId,
              selectedTileId: null,
            };
          }

          if (state.selectedTileId && state.selectedTileId in selectedTileset.tiles) {
            return { selectedLayerId };
          }

          const [firstTileId] = Object.keys(selectedTileset.tiles);
          return {
            selectedLayerId,
            selectedTileId: firstTileId ?? null,
          };
        }),
      setSelectedPathId: (selectedPathId) => set({ selectedPathId }),
      setSelectedTileId: (selectedTileId) => set({ selectedTileId }),
      setTool: (tool) => set({ tool }),

      syncDerivedState: () => {
        const state = get();
        const nextState: Partial<EditorState> = {};

        if (!state.selectedLayerId && state.level.layers.length > 0) {
          nextState.selectedLayerId = state.level.layers[0].id;
        }

        const effectiveLayerId = nextState.selectedLayerId ?? state.selectedLayerId;
        const selectedTileset = getTilesetForLayer(state.level, effectiveLayerId);

        if (!selectedTileset) {
          nextState.selectedTileId = null;
          nextState.assetPathInput = '';
        } else {
          nextState.assetPathInput = selectedTileset.imageSrc;
          if (!state.selectedTileId || !(state.selectedTileId in selectedTileset.tiles)) {
            const [firstTileId] = Object.keys(selectedTileset.tiles);
            nextState.selectedTileId = firstTileId ?? null;
          }
        }

        if (
          state.selectedEntityPathId &&
          !state.level.paths.some((path) => path.id === state.selectedEntityPathId)
        ) {
          nextState.selectedEntityPathId = null;
        }

        if (
          state.selectedPathId &&
          !state.level.paths.some((path) => path.id === state.selectedPathId)
        ) {
          nextState.selectedPathId = null;
        }

        if (
          state.selectedEntityId &&
          !state.level.entities.some((entity) => entity.id === state.selectedEntityId)
        ) {
          nextState.selectedEntityId = null;
        }

        if (Object.keys(nextState).length > 0) {
          set(nextState);
        }
      },

      undo: () => {
        const { pastLevels, level } = get();
        const previousLevel = pastLevels[0];
        if (!previousLevel) {
          return;
        }

        set((state) => ({
          futureLevels: [cloneLevel(level), ...state.futureLevels].slice(0, HISTORY_LIMIT),
          level: cloneLevel(previousLevel),
          pastLevels: state.pastLevels.slice(1),
        }));
        get().syncDerivedState();
      },

      updateSelectedEntity: (updates) => {
        const { level, selectedEntityId } = get();
        const selectedEntity =
          level.entities.find((entity) => entity.id === selectedEntityId) ?? null;
        if (!selectedEntity) {
          return;
        }

        set((state) => ({
          level: upsertEntity(state.level, {
            ...selectedEntity,
            ...updates,
          }),
        }));
      },

      updateSelectedEntityType: (nextType) => {
        const { level, selectedEntityId } = get();
        const selectedEntity =
          level.entities.find((entity) => entity.id === selectedEntityId) ?? null;
        if (!selectedEntity) {
          return;
        }

        set((state) => {
          const baseEntity = {
            ...selectedEntity,
            type: nextType,
            pathId: nextType === 'enemy-patroller' ? selectedEntity.pathId : undefined,
          };

          if (nextType === 'player') {
            return {
              level: {
                ...state.level,
                entities: [
                  ...state.level.entities
                    .filter((entity) => entity.id === selectedEntity.id || entity.type !== 'player')
                    .filter((entity) => entity.id !== selectedEntity.id),
                  baseEntity,
                ],
              },
            };
          }

          return {
            level: upsertEntity(state.level, baseEntity),
          };
        });
      },
    }),
    {
      name: EDITOR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.syncDerivedState();
      },
      partialize: (state) => ({
        assetPathInput: state.assetPathInput,
        futureLevels: state.futureLevels,
        layerVisibility: state.layerVisibility,
        inactiveLayerOpacity: state.inactiveLayerOpacity,
        level: state.level,
        pastLevels: state.pastLevels,
        selectedEntityId: state.selectedEntityId,
        selectedEntityPathId: state.selectedEntityPathId,
        selectedEntityType: state.selectedEntityType,
        selectedLayerId: state.selectedLayerId,
        selectedLevelAssetPath: state.selectedLevelAssetPath,
        selectedPathId: state.selectedPathId,
        selectedTileId: state.selectedTileId,
        tool: state.tool,
      }),
    },
  ),
);
