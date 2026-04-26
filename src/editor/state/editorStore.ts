import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import defaultLevel from '../../assets/levels/shipInterior.level.json';
import { getTilesetTilePositionMap } from '../../scenes/ShipInteriorScene/level';
import type {
  RawShipInteriorLevel,
  ShipInteriorEntityDefinition,
  ShipInteriorTileId,
} from '../../scenes/ShipInteriorScene/level';
import type { AssetUrlMap, EditorTool, ImageMap, PlaceableEntityType } from '../shared/editorTypes';
import {
  bundledLevels,
  getLevelMaterialPlacements,
  hydrateLevelTilesets,
} from '../shared/levelCatalog';
import { cloneLevel, getTilesetForLayer, removeEntity, upsertEntity } from '../shared/levelEditing';
import { getTilesetMaterials, type MaterialPlacementMap } from '../shared/materials';
import {
  applyEditorHistoryEntry,
  cloneMaterialPlacements,
  createEditorHistoryEntry,
  type EditorDocument,
  type EditorHistoryEntry,
} from './history';

type EditorState = {
  assetPathInput: string;
  assetUrls: AssetUrlMap;
  futureHistory: EditorHistoryEntry[];
  images: ImageMap;
  layerVisibility: Record<string, boolean>;
  inactiveLayerOpacity: number;
  level: RawShipInteriorLevel;
  materialPlacements: MaterialPlacementMap;
  openPathMenuId: string | null;
  pastHistory: EditorHistoryEntry[];
  renamingPathId: string | null;
  renamingPathValue: string;
  selectedLevelAssetPath: string | null;
  selectedMaterialId: string | null;
  selectedEntityId: string | null;
  selectedEntityPathId: string | null;
  selectedEntityType: PlaceableEntityType;
  selectedLayerId: string | null;
  selectedPathId: string | null;
  selectedTileId: ShipInteriorTileId | null;
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
  setDocument: (
    updater: EditorDocument | ((currentDocument: EditorDocument) => EditorDocument),
  ) => void;
  setDocumentWithoutHistory: (
    updater: EditorDocument | ((currentDocument: EditorDocument) => EditorDocument),
  ) => void;
  setLevel: (
    updater: RawShipInteriorLevel | ((currentLevel: RawShipInteriorLevel) => RawShipInteriorLevel),
  ) => void;
  commitDocumentChange: (previousDocument: EditorDocument) => void;
  setOpenPathMenuId: (pathId: string | null) => void;
  setRenamingPathId: (pathId: string | null) => void;
  setRenamingPathValue: (value: string) => void;
  setSelectedEntityId: (entityId: string | null) => void;
  setSelectedEntityPathId: (pathId: string | null) => void;
  setSelectedEntityType: (entityType: PlaceableEntityType) => void;
  setSelectedLayerId: (layerId: string | null) => void;
  setSelectedMaterialId: (materialId: string | null) => void;
  setSelectedPathId: (pathId: string | null) => void;
  setSelectedTileId: (tileId: ShipInteriorTileId | null) => void;
  setTool: (tool: EditorTool) => void;
  syncDerivedState: () => void;
  undo: () => void;
  updateSelectedEntity: (updates: Partial<ShipInteriorEntityDefinition>) => void;
  updateSelectedEntityType: (nextType: PlaceableEntityType) => void;
};

type EditorStore = EditorState & EditorActions;

const initialLevel = hydrateLevelTilesets(defaultLevel as unknown as RawShipInteriorLevel);
const initialMaterialPlacements = getLevelMaterialPlacements(defaultLevel);
const HISTORY_LIMIT = 100;
const EDITOR_STORAGE_KEY = 'comet-bursters.editor';
const initialSelectedLevelAssetPath =
  bundledLevels.find((entry) => entry.level.name === initialLevel.name)?.assetPath ?? null;

const editorStorage = createJSONStorage(() => ({
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('Editor state was not persisted because localStorage quota was exceeded.');
        return;
      }

      throw error;
    }
  },
  removeItem: (name: string) => localStorage.removeItem(name),
}));

function buildLevelResetState(
  level: RawShipInteriorLevel,
  selectedLevelAssetPath: string | null,
  materialPlacements: MaterialPlacementMap = {},
): Partial<EditorState> {
  return {
    assetPathInput: '',
    futureHistory: [],
    layerVisibility: {},
    inactiveLayerOpacity: 0.35,
    level,
    materialPlacements: cloneMaterialPlacements(materialPlacements),
    openPathMenuId: null,
    pastHistory: [],
    renamingPathId: null,
    renamingPathValue: '',
    selectedEntityId: null,
    selectedEntityPathId: null,
    selectedLayerId: level.layers[0]?.id ?? null,
    selectedLevelAssetPath,
    selectedMaterialId: null,
    selectedPathId: null,
    selectedTileId: null,
    tool: 'select',
  };
}

function buildInitialEditorState(): EditorState {
  return {
    assetPathInput: '',
    assetUrls: {},
    futureHistory: [],
    images: {},
    layerVisibility: {},
    inactiveLayerOpacity: 0.35,
    level: cloneLevel(initialLevel),
    materialPlacements: cloneMaterialPlacements(initialMaterialPlacements),
    openPathMenuId: null,
    pastHistory: [],
    renamingPathId: null,
    renamingPathValue: '',
    selectedLevelAssetPath: initialSelectedLevelAssetPath,
    selectedEntityId: null,
    selectedEntityPathId: null,
    selectedEntityType: 'enemy-patroller',
    selectedLayerId: initialLevel.layers[0]?.id ?? null,
    selectedMaterialId: null,
    selectedPathId: null,
    selectedTileId: null,
    tool: 'select',
  };
}

function getEditorDocument(state: EditorState): EditorDocument {
  return {
    level: state.level,
    materialPlacements: state.materialPlacements,
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
          const parsed = JSON.parse(text) as unknown;
          set(
            buildLevelResetState(
              hydrateLevelTilesets(parsed as RawShipInteriorLevel),
              null,
              getLevelMaterialPlacements(parsed),
            ),
          );
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

        set(
          buildLevelResetState(
            cloneLevel(entry.level),
            assetPath,
            cloneMaterialPlacements(entry.materialPlacements),
          ),
        );
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
        const { futureHistory } = get();
        const nextEntry = futureHistory[0];
        if (!nextEntry) {
          return;
        }

        set((state) => {
          const nextDocument = applyEditorHistoryEntry(getEditorDocument(state), nextEntry, 'after');
          return {
            futureHistory: state.futureHistory.slice(1),
            level: nextDocument.level,
            materialPlacements: nextDocument.materialPlacements,
            pastHistory: [nextEntry, ...state.pastHistory].slice(0, HISTORY_LIMIT),
          };
        });
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
      setDocument: (updater) =>
        set((state) => {
          const currentDocument = getEditorDocument(state);
          const nextDocument = typeof updater === 'function' ? updater(currentDocument) : updater;
          const historyEntry = createEditorHistoryEntry(currentDocument, nextDocument);
          if (!historyEntry) {
            return {};
          }

          return {
            futureHistory: [],
            level: cloneLevel(nextDocument.level),
            materialPlacements: cloneMaterialPlacements(nextDocument.materialPlacements),
            pastHistory: [historyEntry, ...state.pastHistory].slice(0, HISTORY_LIMIT),
          };
        }),
      setDocumentWithoutHistory: (updater) =>
        set((state) => {
          const currentDocument = getEditorDocument(state);
          const nextDocument = typeof updater === 'function' ? updater(currentDocument) : updater;
          const historyEntry = createEditorHistoryEntry(currentDocument, nextDocument);
          if (!historyEntry) {
            return {};
          }

          return {
            level: cloneLevel(nextDocument.level),
            materialPlacements: cloneMaterialPlacements(nextDocument.materialPlacements),
          };
        }),
      setLevel: (updater) =>
        set((state) => {
          const nextLevel = typeof updater === 'function' ? updater(state.level) : updater;
          const currentDocument = getEditorDocument(state);
          const nextDocument = {
            level: nextLevel,
            materialPlacements: state.materialPlacements,
          };
          const historyEntry = createEditorHistoryEntry(currentDocument, nextDocument);
          if (!historyEntry) {
            return {};
          }
          return {
            futureHistory: [],
            level: cloneLevel(nextLevel),
            pastHistory: [historyEntry, ...state.pastHistory].slice(0, HISTORY_LIMIT),
          };
        }),
      commitDocumentChange: (previousDocument) =>
        set((state) => {
          const historyEntry = createEditorHistoryEntry(previousDocument, getEditorDocument(state));
          if (!historyEntry) {
            return {};
          }

          return {
            futureHistory: [],
            pastHistory: [historyEntry, ...state.pastHistory].slice(0, HISTORY_LIMIT),
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
          const materialIds = getTilesetMaterials(selectedTileset);
          const [firstMaterialId] = materialIds;
          if (!selectedTileset) {
            return {
              selectedLayerId,
              selectedMaterialId: null,
              selectedTileId: null,
            };
          }

          const tilePositions = getTilesetTilePositionMap(selectedTileset);

          if (state.selectedTileId !== null && String(state.selectedTileId) in tilePositions) {
            return {
              selectedLayerId,
              selectedMaterialId:
                state.selectedMaterialId && materialIds.includes(state.selectedMaterialId)
                  ? state.selectedMaterialId
                  : (firstMaterialId ?? null),
            };
          }

          const [firstTileId] = Object.keys(tilePositions);
          return {
            selectedLayerId,
            selectedMaterialId: firstMaterialId ?? null,
            selectedTileId: firstTileId ? Number.parseInt(firstTileId, 10) : null,
          };
        }),
      setSelectedMaterialId: (selectedMaterialId) => set({ selectedMaterialId }),
      setSelectedPathId: (selectedPathId) => set({ selectedPathId }),
      setSelectedTileId: (selectedTileId) => set({ selectedTileId }),
      setTool: (tool) => set({ tool }),

      syncDerivedState: () => {
        const state = get();
        const nextState: Partial<EditorState> = {};
        const hydratedLevel = hydrateLevelTilesets(state.level);

        if (JSON.stringify(hydratedLevel.tilesets) !== JSON.stringify(state.level.tilesets)) {
          nextState.level = hydratedLevel;
        }

        const effectiveLevel = nextState.level ?? state.level;

        if (!state.selectedLayerId && effectiveLevel.layers.length > 0) {
          nextState.selectedLayerId = effectiveLevel.layers[0].id;
        }

        const effectiveLayerId = nextState.selectedLayerId ?? state.selectedLayerId;
        const selectedTileset = getTilesetForLayer(effectiveLevel, effectiveLayerId);

        if (!selectedTileset) {
          nextState.selectedMaterialId = null;
          nextState.selectedTileId = null;
          nextState.assetPathInput = '';
        } else {
          nextState.assetPathInput = selectedTileset.imageSrc;
          const materialIds = getTilesetMaterials(selectedTileset);
          if (!state.selectedMaterialId || !materialIds.includes(state.selectedMaterialId)) {
            const [firstMaterialId] = materialIds;
            nextState.selectedMaterialId = firstMaterialId ?? null;
          }
          const tilePositions = getTilesetTilePositionMap(selectedTileset);
          if (state.selectedTileId === null || !(String(state.selectedTileId) in tilePositions)) {
            const [firstTileId] = Object.keys(tilePositions);
            nextState.selectedTileId = firstTileId ? Number.parseInt(firstTileId, 10) : null;
          }
        }

        if (
          state.selectedEntityPathId &&
          !effectiveLevel.paths.some((path) => path.id === state.selectedEntityPathId)
        ) {
          nextState.selectedEntityPathId = null;
        }

        if (
          state.selectedPathId &&
          !effectiveLevel.paths.some((path) => path.id === state.selectedPathId)
        ) {
          nextState.selectedPathId = null;
        }

        if (
          state.selectedEntityId &&
          !effectiveLevel.entities.some((entity) => entity.id === state.selectedEntityId)
        ) {
          nextState.selectedEntityId = null;
        }

        if (Object.keys(nextState).length > 0) {
          set(nextState);
        }
      },

      undo: () => {
        const { pastHistory } = get();
        const previousEntry = pastHistory[0];
        if (!previousEntry) {
          return;
        }

        set((state) => {
          const previousDocument = applyEditorHistoryEntry(
            getEditorDocument(state),
            previousEntry,
            'before',
          );
          return {
            futureHistory: [previousEntry, ...state.futureHistory].slice(0, HISTORY_LIMIT),
            level: previousDocument.level,
            materialPlacements: previousDocument.materialPlacements,
            pastHistory: state.pastHistory.slice(1),
          };
        });
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
            sprite: nextType === 'column' ? '../columnPixelart.png' : undefined,
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
      storage: editorStorage,
      onRehydrateStorage: () => (state) => {
        state?.syncDerivedState();
      },
      partialize: (state) => ({
        assetPathInput: state.assetPathInput,
        layerVisibility: state.layerVisibility,
        inactiveLayerOpacity: state.inactiveLayerOpacity,
        level: state.level,
        selectedEntityId: state.selectedEntityId,
        selectedEntityPathId: state.selectedEntityPathId,
        selectedEntityType: state.selectedEntityType,
        selectedLayerId: state.selectedLayerId,
        selectedLevelAssetPath: state.selectedLevelAssetPath,
        selectedMaterialId: state.selectedMaterialId,
        selectedPathId: state.selectedPathId,
        selectedTileId: state.selectedTileId,
        tool: state.tool,
      }),
    },
  ),
);
