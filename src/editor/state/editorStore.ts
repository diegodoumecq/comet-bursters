import { create } from 'zustand';

import defaultLevel from '../../assets/levels/shipInterior.level.json';
import type {
  RawShipInteriorLevel,
  ShipInteriorEntityDefinition,
} from '../../scenes/ShipInteriorScene/level';
import type { AssetUrlMap, EditorTool, ImageMap, PlaceableEntityType } from '../shared/editorTypes';
import { bundledLevels } from '../shared/levelCatalog';
import {
  cloneLevel,
  getTilesetForLayer,
  removeEntity,
  serializeShipInteriorLevel,
  upsertEntity,
} from '../shared/levelEditing';

type EditorState = {
  assetPathInput: string;
  assetUrls: AssetUrlMap;
  images: ImageMap;
  level: RawShipInteriorLevel;
  openPathMenuId: string | null;
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
  exportToClipboard: () => Promise<void>;
  importLevelFromText: (text: string, fileName: string) => void;
  loadBundledLevel: (assetPath: string) => void;
  pickTilesetPng: (file: File) => void;
  savePathRename: (pathId: string) => void;
  setAssetPathInput: (value: string) => void;
  setImages: (images: ImageMap) => void;
  setLevel: (
    updater: RawShipInteriorLevel | ((currentLevel: RawShipInteriorLevel) => RawShipInteriorLevel),
  ) => void;
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
  updateSelectedEntity: (updates: Partial<ShipInteriorEntityDefinition>) => void;
  updateSelectedEntityType: (nextType: PlaceableEntityType) => void;
};

type EditorStore = EditorState & EditorActions;

const initialLevel = defaultLevel as unknown as RawShipInteriorLevel;

export const useEditorStore = create<EditorStore>((set, get) => ({
  assetPathInput: '',
  assetUrls: {},
  images: {},
  level: cloneLevel(initialLevel),
  openPathMenuId: null,
  renamingPathId: null,
  renamingPathValue: '',
  selectedLevelAssetPath:
    bundledLevels.find((entry) => entry.level.name === initialLevel.name)?.assetPath ?? null,
  selectedEntityId: null,
  selectedEntityPathId: null,
  selectedEntityType: 'enemy-patroller',
  selectedLayerId: initialLevel.layers[0]?.id ?? null,
  selectedPathId: null,
  selectedTileId: null,
  status: 'Ready',
  tool: 'select',

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
      status: `Updated ${selectedTileset.id} asset path`,
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
      status: `Deleted path ${pathId}`,
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
      status: `Deleted ${selectedEntityId}`,
    }));
  },

  exportToClipboard: async () => {
    const json = serializeShipInteriorLevel(get().level);
    await navigator.clipboard.writeText(json);
  },

  importLevelFromText: (text, fileName) => {
    try {
      const parsed = JSON.parse(text) as RawShipInteriorLevel;
      set({
        level: parsed,
        selectedLevelAssetPath: null,
      });
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

    set({
      level: cloneLevel(entry.level),
      selectedLevelAssetPath: assetPath,
    });
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
        status: `Loaded preview asset ${file.name}`,
      };
    });
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
      status: `Renamed path to ${nextId}`,
    }));
  },

  setAssetPathInput: (assetPathInput) => set({ assetPathInput }),
  setImages: (images) => set({ images }),
  setLevel: (updater) =>
    set((state) => ({
      level: typeof updater === 'function' ? updater(state.level) : updater,
    })),
  setOpenPathMenuId: (openPathMenuId) => set({ openPathMenuId }),
  setRenamingPathId: (renamingPathId) => set({ renamingPathId }),
  setRenamingPathValue: (renamingPathValue) => set({ renamingPathValue }),
  setSelectedEntityId: (selectedEntityId) => set({ selectedEntityId }),
  setSelectedEntityPathId: (selectedEntityPathId) => set({ selectedEntityPathId }),
  setSelectedEntityType: (selectedEntityType) => set({ selectedEntityType }),
  setSelectedLayerId: (selectedLayerId) => set({ selectedLayerId }),
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

  updateSelectedEntity: (updates) => {
    const { level, selectedEntityId } = get();
    const selectedEntity = level.entities.find((entity) => entity.id === selectedEntityId) ?? null;
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
    const selectedEntity = level.entities.find((entity) => entity.id === selectedEntityId) ?? null;
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
          status: `Updated ${selectedEntity.id}`,
        };
      }

      return {
        level: upsertEntity(state.level, baseEntity),
        status: `Updated ${selectedEntity.id}`,
      };
    });
  },
}));
