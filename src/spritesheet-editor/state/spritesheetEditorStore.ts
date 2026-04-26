import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  cloneTileTopology,
  pruneTileTopology,
  type TileTopology,
  type TileTopologyDirection,
  type TileTopologyRelation,
} from '../../editor/shared/autotile';
import type {
  EditorTilesetDefinition as SpritesheetEditorTilesetDefinition,
} from '../../editor/shared/editorTileset';
import { shipInteriorTileAssets } from '../../scenes/ShipInteriorScene/tileAssets';
import { bundledTilesets } from '../../scenes/ShipInteriorScene/tilesetCatalog';
import type {
  SpritesheetEditorDocument,
  SpritesheetEditorHistoryEntry,
} from './history';

export type TileEntry = {
  id: number;
  name: string;
  column: number;
  material?: string;
  row: number;
  topology?: TileTopology;
  variantGroup?: string;
  variantWeight?: number;
};

export type Materials = string[];
export type PreviewMode = 'sheet' | 'topology';

export const editorBundledTilesets = bundledTilesets as Array<{
  fileName: string;
  tileset: SpritesheetEditorTilesetDefinition;
}>;

function normalizeTileEntry(entry: TileEntry): TileEntry {
  return {
    ...entry,
    name:
      typeof entry.name === 'string' && entry.name.trim()
        ? entry.name
        : `tile_${entry.id}`,
  };
}

function cloneMaterials(materials: Materials | undefined): Materials | undefined {
  return materials ? [...materials] : undefined;
}

export function makeTileEntries(tileset: SpritesheetEditorTilesetDefinition): TileEntry[] {
  const legacyTileset = tileset as SpritesheetEditorTilesetDefinition & {
    tileMaterials?: Record<string, string>;
    tiles: unknown;
  };
  const entries = Array.isArray(legacyTileset.tiles)
    ? legacyTileset.tiles.map((tile) => ({
        column: tile.position[0],
        id: tile.id,
        name: tile.name || `tile_${tile.id}`,
        material: tile.material,
        row: tile.position[1],
        topology: cloneTileTopology(tile.topology),
        variantGroup: tile.variantGroup,
        variantWeight: tile.variantWeight,
      }))
    : Object.entries(legacyTileset.tiles as Record<string, [number, number]>).map(
        ([id, [column, row]]) => ({
          column,
          id: Number.parseInt(id, 10),
          name: id,
          material: legacyTileset.tileMaterials?.[id],
          row,
        }),
      );

  return entries.sort(
    (left, right) =>
      left.row - right.row || left.column - right.column || left.name.localeCompare(right.name),
  );
}

function cloneTileEntry(entry: TileEntry): TileEntry {
  return normalizeTileEntry({
    ...entry,
    topology: cloneTileTopology(entry.topology),
  });
}

function cloneTileEntries(entries: TileEntry[]): TileEntry[] {
  return entries.map(cloneTileEntry);
}

function cloneTileset(
  tileset: SpritesheetEditorTilesetDefinition,
): SpritesheetEditorTilesetDefinition {
  const { tiles, ...tilesetWithoutTiles } = tileset;
  return {
    ...tilesetWithoutTiles,
    grid: { ...tileset.grid },
    materials: cloneMaterials(tileset.materials),
    tiles: makeTileEntries(tileset).map((entry) => ({
      id: entry.id,
      name: entry.name,
      ...(entry.material ? { material: entry.material } : {}),
      position: [entry.column, entry.row] as [number, number],
      ...(entry.topology !== undefined
        ? { topology: pruneTileTopology(entry.topology) ?? {} }
        : {}),
      ...(entry.variantGroup ? { variantGroup: entry.variantGroup } : {}),
      ...(entry.variantWeight !== undefined ? { variantWeight: entry.variantWeight } : {}),
    })),
  };
}

function makeTilesetFromEntries(
  tileset: SpritesheetEditorTilesetDefinition,
  entries: TileEntry[],
): SpritesheetEditorTilesetDefinition {
  const { tiles, ...tilesetWithoutTiles } = tileset;
  const materials = cloneMaterials(tileset.materials) ?? [];
  const nextMaterials = Array.from(
    new Set(materials.map((materialName) => materialName.trim()).filter(Boolean)),
  );
  const validMaterialNames = new Set(nextMaterials);

  return {
    ...tilesetWithoutTiles,
    materials: nextMaterials.length > 0 ? nextMaterials : undefined,
    tiles: entries
      .filter((entry) => entry.name.trim())
      .map((entry) => ({
        id: entry.id,
        name: entry.name.trim(),
        ...(entry.material && validMaterialNames.has(entry.material)
          ? { material: entry.material }
          : {}),
        position: [entry.column, entry.row] as [number, number],
        ...(entry.topology !== undefined
          ? { topology: pruneTileTopology(entry.topology) ?? {} }
          : {}),
        ...(entry.variantGroup?.trim() ? { variantGroup: entry.variantGroup.trim() } : {}),
        ...(entry.variantWeight !== undefined
          ? { variantWeight: Math.max(0, entry.variantWeight) }
          : {}),
      })),
  };
}

function makeTilesetFileName(tileset: SpritesheetEditorTilesetDefinition): string {
  return `${tileset.id}.tileset.json`;
}

function makeNewTilesetId(): string {
  const existingIds = new Set(editorBundledTilesets.map((entry) => entry.tileset.id));
  let nextIndex = editorBundledTilesets.length + 1;
  let nextId = `new-tileset-${nextIndex}`;

  while (existingIds.has(nextId)) {
    nextIndex += 1;
    nextId = `new-tileset-${nextIndex}`;
  }

  return nextId;
}

function makeMaterialName(materials: Materials | undefined): string {
  const existingNames = new Set(materials ?? []);
  let nextIndex = existingNames.size + 1;
  let nextName = `material_${nextIndex}`;

  while (existingNames.has(nextName)) {
    nextIndex += 1;
    nextName = `material_${nextIndex}`;
  }

  return nextName;
}

function makeNextTileId(entries: TileEntry[]): number {
  return entries.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) + 1;
}

function makeDuplicateTileName(entries: TileEntry[], sourceName: string): string {
  const existingNames = new Set(entries.map((entry) => entry.name));
  const baseName = sourceName.trim() || 'tile';
  let nextId = `${baseName}_copy`;
  let suffix = 2;

  while (existingNames.has(nextId)) {
    nextId = `${baseName}_copy_${suffix}`;
    suffix += 1;
  }

  return nextId;
}

export function readNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

type SpritesheetEditorState = {
  futureHistory: SpritesheetEditorHistoryEntry[];
  pastHistory: SpritesheetEditorHistoryEntry[];
  previewMode: PreviewMode;
  previewZoom: number;
  selectedFileName: string;
  selectedTileId: number | null;
  tileDeleteIndex: number | null;
  tileEntries: TileEntry[];
  tileset: SpritesheetEditorTilesetDefinition | null;
};

type SpritesheetEditorActions = {
  addMaterial: () => void;
  addTileEntry: () => void;
  createNewTileset: () => void;
  deleteMaterial: (materialName: string) => void;
  deleteTileEntry: (index: number) => void;
  duplicateSelectedTile: () => void;
  redo: () => void;
  renameMaterial: (oldName: string, nextName: string) => void;
  resetEditor: () => void;
  saveTileset: () => Promise<void>;
  selectTileset: (fileName: string) => void;
  setPreviewMode: (previewMode: PreviewMode) => void;
  setSelectedFileName: (selectedFileName: string) => void;
  setSelectedTileId: (selectedTileId: number | null) => void;
  setTileDeleteIndex: (tileDeleteIndex: number | null) => void;
  syncDerivedState: () => void;
  undo: () => void;
  updateGrid: (key: keyof SpritesheetEditorTilesetDefinition['grid'], value: number) => void;
  updatePreviewZoom: (nextZoom: number) => void;
  updateTileEntry: (index: number, updates: Partial<TileEntry>) => void;
  updateTileName: (index: number, nextName: string) => void;
  updateTileMaterial: (tileId: number, materialName: string) => void;
  updateTileTopologyEnabled: (tileId: number, enabled: boolean) => void;
  updateTileTopologyRelation: (
    tileId: number,
    direction: TileTopologyDirection,
    relation: TileTopologyRelation,
  ) => void;
  updateTileVariantGroup: (tileId: number, variantGroup: string) => void;
  updateTileVariantWeight: (tileId: number, variantWeight: number) => void;
  updateTilesetId: (id: string) => void;
  updateTilesetImageSrc: (imageSrc: string) => void;
};

type SpritesheetEditorStore = SpritesheetEditorState & SpritesheetEditorActions;

const initialEntry = editorBundledTilesets[0] ?? null;
const initialTileEntries = initialEntry ? makeTileEntries(initialEntry.tileset) : [];
const HISTORY_LIMIT = 100;
const SPRITESHEET_EDITOR_STORAGE_KEY = 'comet-bursters.spritesheet-editor-v2';

function cloneDocument(document: SpritesheetEditorDocument): SpritesheetEditorDocument {
  return {
    selectedFileName: document.selectedFileName,
    selectedTileId: document.selectedTileId,
    tileEntries: cloneTileEntries(document.tileEntries),
    tileset: document.tileset ? cloneTileset(document.tileset) : null,
  };
}

function getDocument(state: SpritesheetEditorState): SpritesheetEditorDocument {
  return cloneDocument({
    selectedFileName: state.selectedFileName,
    selectedTileId: state.selectedTileId,
    tileEntries: state.tileEntries,
    tileset: state.tileset,
  });
}

function documentsEqual(
  left: SpritesheetEditorDocument,
  right: SpritesheetEditorDocument,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withHistory(
  state: SpritesheetEditorState,
  changes: Partial<SpritesheetEditorState>,
): Partial<SpritesheetEditorState> {
  const before = getDocument(state);
  const after = cloneDocument({
    selectedFileName: changes.selectedFileName ?? state.selectedFileName,
    selectedTileId:
      changes.selectedTileId === undefined ? state.selectedTileId : changes.selectedTileId,
    tileEntries: changes.tileEntries ?? state.tileEntries,
    tileset: changes.tileset === undefined ? state.tileset : changes.tileset,
  });
  if (documentsEqual(before, after)) {
    return changes;
  }

  return {
    ...changes,
    futureHistory: [],
    pastHistory: [{ before, after }, ...state.pastHistory].slice(0, HISTORY_LIMIT),
  };
}

function makeInitialSpritesheetEditorState(): SpritesheetEditorState {
  return {
    futureHistory: [],
    pastHistory: [],
    previewMode: 'sheet',
    previewZoom: 2,
    selectedFileName: initialEntry?.fileName ?? '',
    selectedTileId: initialTileEntries[0]?.id ?? null,
    tileDeleteIndex: null,
    tileEntries: cloneTileEntries(initialTileEntries),
    tileset: initialEntry ? cloneTileset(initialEntry.tileset) : null,
  };
}

export const useSpritesheetEditorStore = create<SpritesheetEditorStore>()(
  persist(
    (set, get) => ({
      ...makeInitialSpritesheetEditorState(),

      addMaterial: () =>
        set((state) => {
          if (!state.tileset) {
            return {};
          }

          const nextName = makeMaterialName(state.tileset.materials);
          return withHistory(state, {
            tileset: {
              ...state.tileset,
              materials: [...(state.tileset.materials ?? []), nextName],
            },
          });
        }),

      addTileEntry: () =>
        set((state) => {
          const nextId = makeNextTileId(state.tileEntries);
          return withHistory(state, {
            selectedTileId: nextId,
            tileEntries: [...state.tileEntries, { column: 0, id: nextId, name: `tile_${nextId}`, row: 0 }],
          });
        }),

      createNewTileset: () => {
        const firstAsset = shipInteriorTileAssets[0];
        if (!firstAsset) {
          alert('Cannot create a tileset without a PNG asset in src/assets/tiles.');
          return;
        }

        set({
          futureHistory: [],
          pastHistory: [],
          selectedFileName: '',
          selectedTileId: null,
          tileEntries: [],
          tileset: {
            id: makeNewTilesetId(),
            imageSrc: firstAsset.imageSrc,
            grid: {
              frameWidth: 32,
              frameHeight: 32,
              offsetX: 0,
              offsetY: 0,
              gapX: 0,
              gapY: 0,
            },
            tiles: [],
          },
        });
      },

      deleteMaterial: (materialName) =>
        set((state) => {
          const current = state.tileset;
          if (!current?.materials) {
            return {};
          }

          const nextMaterials = current.materials.filter(
            (currentMaterialName) => currentMaterialName !== materialName,
          );
          return withHistory(state, {
            tileEntries: state.tileEntries.map((entry) =>
              entry.material === materialName ? { ...entry, material: undefined } : entry,
            ),
            tileset: {
              ...current,
              materials: nextMaterials.length > 0 ? nextMaterials : undefined,
            },
          });
        }),

      deleteTileEntry: (index) =>
        set((state) => {
          const deletedId = state.tileEntries[index]?.id;
          const nextEntries = state.tileEntries.filter((_, entryIndex) => entryIndex !== index);
          return withHistory(state, {
            selectedTileId:
              state.selectedTileId === deletedId
                ? (nextEntries[0]?.id ?? null)
                : state.selectedTileId,
            tileDeleteIndex: null,
            tileEntries: nextEntries,
          });
        }),

      duplicateSelectedTile: () =>
        set((state) => {
          const selectedIndex = state.tileEntries.findIndex(
            (entry) => entry.id === state.selectedTileId,
          );
          const selectedEntry = selectedIndex >= 0 ? state.tileEntries[selectedIndex] : null;
          if (!selectedEntry) {
            return {};
          }

          const duplicatedEntry = {
            ...cloneTileEntry(selectedEntry),
            id: makeNextTileId(state.tileEntries),
            name: makeDuplicateTileName(state.tileEntries, selectedEntry.name),
          };
          const nextEntries = [...state.tileEntries];
          nextEntries.splice(selectedIndex + 1, 0, duplicatedEntry);

          return withHistory(state, {
            selectedTileId: duplicatedEntry.id,
            tileEntries: nextEntries,
          });
        }),

      redo: () => {
        const { futureHistory } = get();
        const nextEntry = futureHistory[0];
        if (!nextEntry) {
          return;
        }

        set((state) => ({
          ...cloneDocument(nextEntry.after),
          futureHistory: state.futureHistory.slice(1),
          pastHistory: [nextEntry, ...state.pastHistory].slice(0, HISTORY_LIMIT),
          tileDeleteIndex: null,
        }));
        get().syncDerivedState();
      },

      renameMaterial: (oldName, nextName) =>
        set((state) => {
          const current = state.tileset;
          if (!current?.materials || oldName === nextName) {
            return {};
          }

          const trimmedNextName = nextName.trim();
          if (
            !trimmedNextName ||
            (trimmedNextName !== oldName && current.materials.includes(trimmedNextName))
          ) {
            return {};
          }

          return withHistory(state, {
            tileEntries: state.tileEntries.map((entry) =>
              entry.material === oldName ? { ...entry, material: trimmedNextName } : entry,
            ),
            tileset: {
              ...current,
              materials: current.materials.map((materialName) =>
                materialName === oldName ? trimmedNextName : materialName,
              ),
            },
          });
        }),

      resetEditor: () => {
        set(makeInitialSpritesheetEditorState());
      },

      saveTileset: async () => {
        const { tileEntries, tileset } = get();
        if (!tileset) {
          return;
        }

        const tilesetToSave = makeTilesetFromEntries(tileset, tileEntries);
        const fileName = makeTilesetFileName(tilesetToSave);

        try {
          const response = await fetch('/__editor/save-tileset', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName,
              tileset: tilesetToSave,
            }),
          });

          if (!response.ok) {
            const errorPayload = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(errorPayload?.error ?? 'Failed to save tileset');
          }

          set({ selectedFileName: fileName });
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Failed to save tileset');
        }
      },

      selectTileset: (fileName) => {
        const entry = editorBundledTilesets.find((candidate) => candidate.fileName === fileName);
        if (!entry) {
          return;
        }

        const nextTileset = cloneTileset(entry.tileset);
        const nextEntries = makeTileEntries(nextTileset);
        set({
          futureHistory: [],
          pastHistory: [],
          selectedFileName: fileName,
          selectedTileId: nextEntries[0]?.id ?? null,
          tileEntries: nextEntries,
          tileset: nextTileset,
        });
      },

      setPreviewMode: (previewMode) => set({ previewMode }),
      setSelectedFileName: (selectedFileName) => set({ selectedFileName }),
      setSelectedTileId: (selectedTileId) => set({ selectedTileId }),
      setTileDeleteIndex: (tileDeleteIndex) => set({ tileDeleteIndex }),

      syncDerivedState: () => {
        const state = get();
        const nextState: Partial<SpritesheetEditorState> = {};
        const normalizedEntries = state.tileEntries.map(normalizeTileEntry);

        if (JSON.stringify(normalizedEntries) !== JSON.stringify(state.tileEntries)) {
          nextState.tileEntries = normalizedEntries;
        }

        if (
          state.selectedTileId &&
          !normalizedEntries.some((entry) => entry.id === state.selectedTileId)
        ) {
          nextState.selectedTileId = normalizedEntries[0]?.id ?? null;
        }

        if (state.tileDeleteIndex !== null && !normalizedEntries[state.tileDeleteIndex]) {
          nextState.tileDeleteIndex = null;
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

        set((state) => ({
          ...cloneDocument(previousEntry.before),
          futureHistory: [previousEntry, ...state.futureHistory].slice(0, HISTORY_LIMIT),
          pastHistory: state.pastHistory.slice(1),
          tileDeleteIndex: null,
        }));
        get().syncDerivedState();
      },

      updateGrid: (key, value) =>
        set((state) =>
          withHistory(state, {
            tileset: state.tileset
              ? {
                  ...state.tileset,
                  grid: {
                    ...state.tileset.grid,
                    [key]: value,
                  },
                }
              : state.tileset,
          }),
        ),

      updatePreviewZoom: (nextZoom) =>
        set({
          previewZoom: Math.min(6, Math.max(0.5, nextZoom)),
        }),

      updateTileEntry: (index, updates) =>
        set((state) =>
          withHistory(state, {
            tileEntries: state.tileEntries.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, ...updates } : entry,
            ),
          }),
        ),

      updateTileName: (index, nextName) =>
        set((state) => {
          const nextEntries = state.tileEntries.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, name: nextName } : entry,
          );
          return withHistory(state, {
            tileEntries: nextEntries,
          });
        }),

      updateTileMaterial: (tileId, materialName) =>
        set((state) =>
          withHistory(state, {
            tileEntries: state.tileEntries.map((entry) =>
              entry.id === tileId ? { ...entry, material: materialName || undefined } : entry,
            ),
          }),
        ),

      updateTileTopologyEnabled: (tileId, enabled) =>
        set((state) =>
          withHistory(state, {
            tileEntries: state.tileEntries.map((entry) =>
              entry.id !== tileId
                ? entry
                : {
                    ...entry,
                    topology: enabled ? (entry.topology ? { ...entry.topology } : {}) : undefined,
                  },
            ),
          }),
        ),

      updateTileTopologyRelation: (tileId, direction, relation) =>
        set((state) =>
          withHistory(state, {
            tileEntries: state.tileEntries.map((entry) => {
              if (entry.id !== tileId || entry.topology === undefined) {
                return entry;
              }

              const nextTopology = { ...(entry.topology ?? {}) };
              if (relation === 'any') {
                delete nextTopology[direction];
              } else {
                nextTopology[direction] = relation;
              }

              return {
                ...entry,
                topology: nextTopology,
              };
            }),
          }),
        ),

      updateTileVariantGroup: (tileId, variantGroup) =>
        set((state) =>
          withHistory(state, {
            tileEntries: state.tileEntries.map((entry) =>
              entry.id === tileId
                ? { ...entry, variantGroup: variantGroup.trim() || undefined }
                : entry,
            ),
          }),
        ),

      updateTileVariantWeight: (tileId, variantWeight) =>
        set((state) =>
          withHistory(state, {
            tileEntries: state.tileEntries.map((entry) =>
              entry.id === tileId ? { ...entry, variantWeight: Math.max(0, variantWeight) } : entry,
            ),
          }),
        ),

      updateTilesetId: (id) =>
        set((state) =>
          withHistory(state, {
            tileset: state.tileset ? { ...state.tileset, id } : state.tileset,
          }),
        ),

      updateTilesetImageSrc: (imageSrc) =>
        set((state) =>
          withHistory(state, {
            tileset: state.tileset ? { ...state.tileset, imageSrc } : state.tileset,
          }),
        ),
    }),
    {
      name: SPRITESHEET_EDITOR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.syncDerivedState();
      },
      partialize: (state) => ({
        previewMode: state.previewMode,
        previewZoom: state.previewZoom,
        selectedFileName: state.selectedFileName,
        selectedTileId: state.selectedTileId,
        tileEntries: state.tileEntries,
        tileset: state.tileset,
      }),
    },
  ),
);
