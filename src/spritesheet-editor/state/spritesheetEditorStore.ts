import { create } from 'zustand';

import type {
  ShipInteriorTilesetDefinition,
  ShipInteriorTilesetTileDefinition,
} from '../../scenes/ShipInteriorScene/level';
import { shipInteriorTileAssets } from '../../scenes/ShipInteriorScene/tileAssets';
import { bundledTilesets } from '../../scenes/ShipInteriorScene/tilesetCatalog';

export type TileEntry = {
  id: string;
  column: number;
  material?: string;
  adjacency?: Partial<Record<AdjacencyDirection, string>>;
  row: number;
};

export type AdjacencyDirection = 'up' | 'right' | 'down' | 'left';
export type Materials = string[];
export type MatchingGroups = string[];
export type PreviewMode = 'sheet' | 'adjacency';
export type SpritesheetEditorTileDefinition = ShipInteriorTilesetTileDefinition & {
  material?: string;
  adjacency?: Partial<Record<AdjacencyDirection, string>>;
};
export type SpritesheetEditorTilesetDefinition = Omit<ShipInteriorTilesetDefinition, 'tiles'> & {
  defaultMatchingGroup?: string;
  materials?: Materials;
  matchingGroups?: MatchingGroups;
  tiles: SpritesheetEditorTileDefinition[];
};

export const adjacencyDirections: AdjacencyDirection[] = ['up', 'right', 'down', 'left'];
export const oppositeDirections: Record<AdjacencyDirection, AdjacencyDirection> = {
  down: 'up',
  left: 'right',
  right: 'left',
  up: 'down',
};
export const editorBundledTilesets = bundledTilesets as Array<{
  fileName: string;
  tileset: SpritesheetEditorTilesetDefinition;
}>;

function cloneMatchingGroups(matchingGroups: MatchingGroups | undefined): MatchingGroups | undefined {
  if (!matchingGroups) {
    return undefined;
  }

  if (Array.isArray(matchingGroups)) {
    return [...matchingGroups];
  }

  return Object.keys(matchingGroups);
}

function cloneMaterials(materials: Materials | undefined): Materials | undefined {
  if (!materials) {
    return undefined;
  }

  if (Array.isArray(materials)) {
    return [...materials];
  }

  return Object.keys(materials);
}

export function makeTileEntries(tileset: SpritesheetEditorTilesetDefinition): TileEntry[] {
  const legacyTileset = tileset as SpritesheetEditorTilesetDefinition & {
    tileMaterials?: Record<string, string>;
    tileMatchingGroups?: Record<string, Partial<Record<AdjacencyDirection, string>>>;
    tiles: unknown;
  };
  const entries = Array.isArray(legacyTileset.tiles)
    ? legacyTileset.tiles.map((tile) => ({
        adjacency: tile.adjacency ? { ...tile.adjacency } : undefined,
        column: tile.position[0],
        id: tile.id,
        material: tile.material,
        row: tile.position[1],
      }))
    : Object.entries(legacyTileset.tiles as Record<string, [number, number]>).map(
        ([id, [column, row]]) => ({
          adjacency: legacyTileset.tileMatchingGroups?.[id]
            ? { ...legacyTileset.tileMatchingGroups[id] }
            : undefined,
          column,
          id,
          material: legacyTileset.tileMaterials?.[id],
          row,
        }),
      );

  return entries.sort(
    (left, right) =>
      left.row - right.row || left.column - right.column || left.id.localeCompare(right.id),
  );
}

function cloneTileset(
  tileset: SpritesheetEditorTilesetDefinition,
): SpritesheetEditorTilesetDefinition {
  const {
    adjacency: _legacyAdjacency,
    tileMaterials: _legacyTileMaterials,
    tileMatchingGroups: _legacyTileMatchingGroups,
    ...tilesetWithoutLegacyFields
  } = tileset as SpritesheetEditorTilesetDefinition & {
    adjacency?: unknown;
    tileMaterials?: unknown;
    tileMatchingGroups?: unknown;
  };

  return {
    ...tilesetWithoutLegacyFields,
    grid: { ...tileset.grid },
    ...(tileset.defaultMatchingGroup ? { defaultMatchingGroup: tileset.defaultMatchingGroup } : {}),
    materials: cloneMaterials(tileset.materials),
    matchingGroups: cloneMatchingGroups(tileset.matchingGroups),
    tiles: makeTileEntries(tileset).map((entry) => ({
      id: entry.id,
      ...(entry.material ? { material: entry.material } : {}),
      ...(entry.adjacency ? { adjacency: { ...entry.adjacency } } : {}),
      position: [entry.column, entry.row] as [number, number],
    })),
  };
}

function makeTilesetFromEntries(
  tileset: SpritesheetEditorTilesetDefinition,
  entries: TileEntry[],
): SpritesheetEditorTilesetDefinition {
  const {
    adjacency: _legacyAdjacency,
    tileMaterials: _legacyTileMaterials,
    tileMatchingGroups: _legacyTileMatchingGroups,
    ...tilesetWithoutLegacyFields
  } = tileset as SpritesheetEditorTilesetDefinition & {
    adjacency?: unknown;
    tileMaterials?: unknown;
    tileMatchingGroups?: unknown;
  };
  const materials = cloneMaterials(tileset.materials) ?? [];
  const nextMaterials = Array.from(
    new Set(materials.map((materialName) => materialName.trim()).filter(Boolean)),
  );
  const validMaterialNames = new Set(nextMaterials);
  const matchingGroups = tileset.matchingGroups ?? [];
  const nextMatchingGroups = Array.from(
    new Set(matchingGroups.map((groupName) => groupName.trim()).filter(Boolean)),
  );
  const validGroupNames = new Set(nextMatchingGroups);
  const defaultMatchingGroup = tileset.defaultMatchingGroup?.trim();

  return {
    ...tilesetWithoutLegacyFields,
    ...(defaultMatchingGroup && validGroupNames.has(defaultMatchingGroup)
      ? { defaultMatchingGroup }
      : {}),
    materials: nextMaterials.length > 0 ? nextMaterials : undefined,
    matchingGroups: nextMatchingGroups.length > 0 ? nextMatchingGroups : undefined,
    tiles: entries
      .filter((entry) => entry.id.trim())
      .map((entry) => {
        const adjacency = Object.fromEntries(
          adjacencyDirections
            .filter((direction) => {
              const groupName = entry.adjacency?.[direction];
              return groupName ? validGroupNames.has(groupName) : false;
            })
            .map((direction) => [direction, entry.adjacency?.[direction]]),
        );
        return {
          id: entry.id.trim(),
          ...(entry.material && validMaterialNames.has(entry.material)
            ? { material: entry.material }
            : {}),
          ...(Object.keys(adjacency).length > 0 ? { adjacency } : {}),
          position: [entry.column, entry.row] as [number, number],
        };
      }),
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

function makeMatchingGroupName(matchingGroups: MatchingGroups | undefined): string {
  const existingNames = new Set(matchingGroups ?? []);
  let nextIndex = existingNames.size + 1;
  let nextName = `group_${nextIndex}`;

  while (existingNames.has(nextName)) {
    nextIndex += 1;
    nextName = `group_${nextIndex}`;
  }

  return nextName;
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

export function readNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

type SpritesheetEditorState = {
  previewMode: PreviewMode;
  previewZoom: number;
  selectedFileName: string;
  selectedTileId: string | null;
  tileDeleteIndex: number | null;
  tileEntries: TileEntry[];
  tileset: SpritesheetEditorTilesetDefinition | null;
};

type SpritesheetEditorActions = {
  addMatchingGroup: () => void;
  addMaterial: () => void;
  addTileEntry: () => void;
  createNewTileset: () => void;
  deleteMatchingGroup: (groupName: string) => void;
  deleteMaterial: (materialName: string) => void;
  deleteTileEntry: (index: number) => void;
  renameMatchingGroup: (oldName: string, nextName: string) => void;
  renameMaterial: (oldName: string, nextName: string) => void;
  saveTileset: () => Promise<void>;
  selectTileset: (fileName: string) => void;
  setPreviewMode: (previewMode: PreviewMode) => void;
  setSelectedFileName: (selectedFileName: string) => void;
  setSelectedTileId: (selectedTileId: string | null) => void;
  setTileDeleteIndex: (tileDeleteIndex: number | null) => void;
  updateDefaultMatchingGroup: (groupName: string) => void;
  updateGrid: (key: keyof SpritesheetEditorTilesetDefinition['grid'], value: number) => void;
  updatePreviewZoom: (nextZoom: number) => void;
  updateTileEntry: (index: number, updates: Partial<TileEntry>) => void;
  updateTileId: (index: number, nextId: string) => void;
  updateTilesetId: (id: string) => void;
  updateTilesetImageSrc: (imageSrc: string) => void;
  updateTileMatchingGroup: (
    tileId: string,
    direction: AdjacencyDirection,
    groupName: string,
  ) => void;
  updateTileMaterial: (tileId: string, materialName: string) => void;
};

type SpritesheetEditorStore = SpritesheetEditorState & SpritesheetEditorActions;

const initialEntry = editorBundledTilesets[0] ?? null;
const initialTileEntries = initialEntry ? makeTileEntries(initialEntry.tileset) : [];

export const useSpritesheetEditorStore = create<SpritesheetEditorStore>()((set, get) => ({
  previewMode: 'sheet',
  previewZoom: 2,
  selectedFileName: initialEntry?.fileName ?? '',
  selectedTileId: initialTileEntries[0]?.id ?? null,
  tileDeleteIndex: null,
  tileEntries: initialTileEntries,
  tileset: initialEntry ? cloneTileset(initialEntry.tileset) : null,

  addMatchingGroup: () =>
    set((state) => {
      if (!state.tileset) {
        return {};
      }

      const nextName = makeMatchingGroupName(state.tileset.matchingGroups);
      return {
        tileset: {
          ...state.tileset,
          matchingGroups: [...(state.tileset.matchingGroups ?? []), nextName],
        },
      };
    }),

  addMaterial: () =>
    set((state) => {
      if (!state.tileset) {
        return {};
      }

      const nextName = makeMaterialName(state.tileset.materials);
      return {
        tileset: {
          ...state.tileset,
          materials: [...(state.tileset.materials ?? []), nextName],
        },
      };
    }),

  addTileEntry: () =>
    set((state) => {
      const nextId = `tile_${state.tileEntries.length + 1}`;
      return {
        selectedTileId: nextId,
        tileEntries: [...state.tileEntries, { column: 0, id: nextId, row: 0 }],
      };
    }),

  createNewTileset: () => {
    const firstAsset = shipInteriorTileAssets[0];
    if (!firstAsset) {
      alert('Cannot create a tileset without a PNG asset in src/assets/tiles.');
      return;
    }

    set({
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
          columns: 1,
          rows: 1,
        },
        tiles: [],
      },
    });
  },

  deleteMatchingGroup: (groupName) =>
    set((state) => {
      const current = state.tileset;
      if (!current?.matchingGroups) {
        return {};
      }

      const nextMatchingGroups = current.matchingGroups.filter(
        (currentGroupName) => currentGroupName !== groupName,
      );
      return {
        tileEntries: state.tileEntries.map((entry) => {
          const nextAdjacency = Object.fromEntries(
            adjacencyDirections
              .filter((direction) => {
                const tileGroupName = entry.adjacency?.[direction];
                return tileGroupName && tileGroupName !== groupName;
              })
              .map((direction) => [direction, entry.adjacency?.[direction]]),
          );
          return {
            ...entry,
            adjacency: Object.keys(nextAdjacency).length > 0 ? nextAdjacency : undefined,
          };
        }),
        tileset: {
          ...current,
          defaultMatchingGroup:
            current.defaultMatchingGroup === groupName ? undefined : current.defaultMatchingGroup,
          matchingGroups: nextMatchingGroups.length > 0 ? nextMatchingGroups : undefined,
        },
      };
    }),

  deleteMaterial: (materialName) =>
    set((state) => {
      const current = state.tileset;
      if (!current?.materials) {
        return {};
      }

      const nextMaterials = current.materials.filter(
        (currentMaterialName) => currentMaterialName !== materialName,
      );
      return {
        tileEntries: state.tileEntries.map((entry) =>
          entry.material === materialName ? { ...entry, material: undefined } : entry,
        ),
        tileset: {
          ...current,
          materials: nextMaterials.length > 0 ? nextMaterials : undefined,
        },
      };
    }),

  deleteTileEntry: (index) =>
    set((state) => {
      const deletedId = state.tileEntries[index]?.id;
      const nextEntries = state.tileEntries.filter((_, entryIndex) => entryIndex !== index);
      return {
        selectedTileId: state.selectedTileId === deletedId ? (nextEntries[0]?.id ?? null) : state.selectedTileId,
        tileDeleteIndex: null,
        tileEntries: nextEntries,
      };
    }),

  renameMatchingGroup: (oldName, nextName) =>
    set((state) => {
      const current = state.tileset;
      if (!current?.matchingGroups || oldName === nextName) {
        return {};
      }

      const trimmedNextName = nextName.trim();
      if (
        !trimmedNextName ||
        (trimmedNextName !== oldName && current.matchingGroups.includes(trimmedNextName))
      ) {
        return {};
      }

      return {
        tileEntries: state.tileEntries.map((entry) => ({
          ...entry,
          adjacency: entry.adjacency
            ? Object.fromEntries(
                adjacencyDirections
                  .filter((direction) => entry.adjacency?.[direction])
                  .map((direction) => [
                    direction,
                    entry.adjacency?.[direction] === oldName
                      ? trimmedNextName
                      : entry.adjacency?.[direction],
                  ]),
              )
            : undefined,
        })),
        tileset: {
          ...current,
          defaultMatchingGroup:
            current.defaultMatchingGroup === oldName
              ? trimmedNextName
              : current.defaultMatchingGroup,
          matchingGroups: current.matchingGroups.map((groupName) =>
            groupName === oldName ? trimmedNextName : groupName,
          ),
        },
      };
    }),

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

      return {
        tileEntries: state.tileEntries.map((entry) =>
          entry.material === oldName ? { ...entry, material: trimmedNextName } : entry,
        ),
        tileset: {
          ...current,
          materials: current.materials.map((materialName) =>
            materialName === oldName ? trimmedNextName : materialName,
          ),
        },
      };
    }),

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
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
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

  updateDefaultMatchingGroup: (groupName) =>
    set((state) => ({
      tileset: state.tileset
        ? {
            ...state.tileset,
            defaultMatchingGroup: groupName || undefined,
          }
        : state.tileset,
    })),

  updateGrid: (key, value) =>
    set((state) => ({
      tileset: state.tileset
        ? {
            ...state.tileset,
            grid: {
              ...state.tileset.grid,
              [key]: value,
            },
          }
        : state.tileset,
    })),

  updatePreviewZoom: (nextZoom) =>
    set({
      previewZoom: Math.min(6, Math.max(0.5, nextZoom)),
    }),

  updateTileEntry: (index, updates) =>
    set((state) => ({
      tileEntries: state.tileEntries.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              ...updates,
            }
          : entry,
      ),
    })),

  updateTileId: (index, nextId) =>
    set((state) => {
      const oldId = state.tileEntries[index]?.id;
      const nextEntries = state.tileEntries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, id: nextId } : entry,
      );
      return {
        selectedTileId: state.selectedTileId === oldId ? nextId : state.selectedTileId,
        tileEntries: nextEntries,
      };
    }),

  updateTilesetId: (id) =>
    set((state) => ({
      tileset: state.tileset ? { ...state.tileset, id } : state.tileset,
    })),

  updateTilesetImageSrc: (imageSrc) =>
    set((state) => ({
      tileset: state.tileset ? { ...state.tileset, imageSrc } : state.tileset,
    })),

  updateTileMatchingGroup: (tileId, direction, groupName) =>
    set((state) => ({
      tileEntries: state.tileEntries.map((entry) => {
        if (entry.id !== tileId) {
          return entry;
        }

        const nextAdjacency = { ...(entry.adjacency ?? {}) };
        if (groupName) {
          nextAdjacency[direction] = groupName;
        } else {
          delete nextAdjacency[direction];
        }

        return {
          ...entry,
          adjacency: Object.keys(nextAdjacency).length > 0 ? nextAdjacency : undefined,
        };
      }),
    })),

  updateTileMaterial: (tileId, materialName) =>
    set((state) => ({
      tileEntries: state.tileEntries.map((entry) =>
        entry.id === tileId ? { ...entry, material: materialName || undefined } : entry,
      ),
    })),
}));
