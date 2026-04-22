import { useEffect, useMemo, useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { ConfirmationDialog } from '@/ui/components/ConfirmationDialog';
import type {
  ShipInteriorTilesetDefinition,
  ShipInteriorTilesetTileDefinition,
} from '../../scenes/ShipInteriorScene/level';
import { shipInteriorTileAssets } from '../../scenes/ShipInteriorScene/tileAssets';
import { bundledTilesets } from '../../scenes/ShipInteriorScene/tilesetCatalog';

type TileEntry = {
  id: string;
  column: number;
  material?: string;
  adjacency?: Partial<Record<AdjacencyDirection, string>>;
  row: number;
};

type AdjacencyDirection = 'up' | 'right' | 'down' | 'left';
type Materials = string[];
type MatchingGroups = string[];
type PreviewMode = 'sheet' | 'adjacency';
type SpritesheetEditorTileDefinition = ShipInteriorTilesetTileDefinition & {
  material?: string;
  adjacency?: Partial<Record<AdjacencyDirection, string>>;
};
type SpritesheetEditorTilesetDefinition = Omit<ShipInteriorTilesetDefinition, 'tiles'> & {
  materials?: Materials;
  matchingGroups?: MatchingGroups;
  tiles: SpritesheetEditorTileDefinition[];
};

const adjacencyDirections: AdjacencyDirection[] = ['up', 'right', 'down', 'left'];
const oppositeDirections: Record<AdjacencyDirection, AdjacencyDirection> = {
  down: 'up',
  left: 'right',
  right: 'left',
  up: 'down',
};
const editorBundledTilesets = bundledTilesets as Array<{
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

function makeTileEntries(tileset: SpritesheetEditorTilesetDefinition): TileEntry[] {
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

  return entries
    .sort(
      (left, right) =>
        left.row - right.row || left.column - right.column || left.id.localeCompare(right.id),
    );
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

  return {
    ...tilesetWithoutLegacyFields,
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

function readNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SpritesheetEditorApp() {
  const initialEntry = editorBundledTilesets[0] ?? null;
  const [selectedFileName, setSelectedFileName] = useState(initialEntry?.fileName ?? '');
  const [tileset, setTileset] = useState<SpritesheetEditorTilesetDefinition | null>(
    initialEntry ? cloneTileset(initialEntry.tileset) : null,
  );
  const [tileEntries, setTileEntries] = useState<TileEntry[]>(
    initialEntry ? makeTileEntries(initialEntry.tileset) : [],
  );
  const [selectedTileId, setSelectedTileId] = useState<string | null>(tileEntries[0]?.id ?? null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [previewZoom, setPreviewZoom] = useState(2);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('sheet');
  const [isTilesetSectionOpen, setIsTilesetSectionOpen] = useState(true);
  const [isGridSectionOpen, setIsGridSectionOpen] = useState(true);
  const [isPreviewSectionOpen, setIsPreviewSectionOpen] = useState(true);
  const [isTilesSectionOpen, setIsTilesSectionOpen] = useState(true);
  const [isMaterialsSectionOpen, setIsMaterialsSectionOpen] = useState(true);
  const [isMatchingGroupsSectionOpen, setIsMatchingGroupsSectionOpen] = useState(true);
  const [isTilePropertiesSectionOpen, setIsTilePropertiesSectionOpen] = useState(true);
  const [tileDeleteIndex, setTileDeleteIndex] = useState<number | null>(null);

  const selectedAsset = useMemo(
    () =>
      tileset
        ? (shipInteriorTileAssets.find((asset) => asset.imageSrc === tileset.imageSrc) ?? null)
        : null,
    [tileset],
  );

  useEffect(() => {
    if (!selectedAsset) {
      setImage(null);
      return;
    }

    let cancelled = false;
    const nextImage = new Image();
    nextImage.onload = () => {
      if (!cancelled) {
        setImage(nextImage);
      }
    };
    nextImage.onerror = () => {
      if (!cancelled) {
        setImage(null);
      }
    };
    nextImage.src = selectedAsset.url;

    return () => {
      cancelled = true;
    };
  }, [selectedAsset]);

  const selectTileset = (fileName: string) => {
    const entry = editorBundledTilesets.find((candidate) => candidate.fileName === fileName);
    if (!entry) {
      return;
    }

    const nextTileset = cloneTileset(entry.tileset);
    const nextEntries = makeTileEntries(nextTileset);
    setSelectedFileName(fileName);
    setTileset(nextTileset);
    setTileEntries(nextEntries);
    setSelectedTileId(nextEntries[0]?.id ?? null);
  };

  const createNewTileset = () => {
    const firstAsset = shipInteriorTileAssets[0];
    if (!firstAsset) {
      alert('Cannot create a tileset without a PNG asset in src/assets/tiles.');
      return;
    }

    const nextId = makeNewTilesetId();
    setSelectedFileName('');
    setTileset({
      id: nextId,
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
    });
    setTileEntries([]);
    setSelectedTileId(null);
  };

  const updateGrid = (key: keyof SpritesheetEditorTilesetDefinition['grid'], value: number) => {
    setTileset((current) =>
      current
        ? {
            ...current,
            grid: {
              ...current.grid,
              [key]: value,
            },
          }
        : current,
    );
  };

  const updateTileEntry = (index: number, updates: Partial<TileEntry>) => {
    setTileEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              ...updates,
            }
          : entry,
      ),
    );
  };

  const updateTileId = (index: number, nextId: string) => {
    const oldId = tileEntries[index]?.id;
    updateTileEntry(index, { id: nextId });

    if (!oldId || oldId === nextId) {
      return;
    }

    if (selectedTileId === oldId) {
      setSelectedTileId(nextId);
    }

  };

  const addTileEntry = () => {
    const nextId = `tile_${tileEntries.length + 1}`;
    setTileEntries((current) => [...current, { column: 0, id: nextId, row: 0 }]);
    setSelectedTileId(nextId);
  };

  const deleteTileEntry = (index: number) => {
    const deletedId = tileEntries[index]?.id;
    setTileEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
    setTileDeleteIndex(null);

    if (selectedTileId === deletedId) {
      const nextEntries = tileEntries.filter((_, entryIndex) => entryIndex !== index);
      setSelectedTileId(nextEntries[0]?.id ?? null);
    }
  };

  const addMaterial = () => {
    setTileset((current) => {
      if (!current) {
        return current;
      }

      const nextName = makeMaterialName(current.materials);
      return {
        ...current,
        materials: [...(current.materials ?? []), nextName],
      };
    });
  };

  const renameMaterial = (oldName: string, nextName: string) => {
    setTileset((current) => {
      if (!current?.materials || oldName === nextName) {
        return current;
      }

      const trimmedNextName = nextName.trim();
      if (
        !trimmedNextName ||
        (trimmedNextName !== oldName && current.materials.includes(trimmedNextName))
      ) {
        return current;
      }

      const nextMaterials = current.materials.map((materialName) =>
        materialName === oldName ? trimmedNextName : materialName,
      );
      setTileEntries((currentEntries) =>
        currentEntries.map((entry) =>
          entry.material === oldName ? { ...entry, material: trimmedNextName } : entry,
        ),
      );

      return {
        ...current,
        materials: nextMaterials,
      };
    });
  };

  const deleteMaterial = (materialName: string) => {
    setTileset((current) => {
      if (!current?.materials) {
        return current;
      }

      const nextMaterials = current.materials.filter(
        (currentMaterialName) => currentMaterialName !== materialName,
      );
      setTileEntries((currentEntries) =>
        currentEntries.map((entry) =>
          entry.material === materialName ? { ...entry, material: undefined } : entry,
        ),
      );

      return {
        ...current,
        materials: nextMaterials.length > 0 ? nextMaterials : undefined,
      };
    });
  };

  const updateTileMaterial = (tileId: string, materialName: string) => {
    setTileEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === tileId ? { ...entry, material: materialName || undefined } : entry,
      ),
    );
  };

  const addMatchingGroup = () => {
    setTileset((current) => {
      if (!current) {
        return current;
      }

      const nextName = makeMatchingGroupName(current.matchingGroups);
      return {
        ...current,
        matchingGroups: [...(current.matchingGroups ?? []), nextName],
      };
    });
  };

  const renameMatchingGroup = (oldName: string, nextName: string) => {
    setTileset((current) => {
      if (!current?.matchingGroups || oldName === nextName) {
        return current;
      }

      const trimmedNextName = nextName.trim();
      if (
        !trimmedNextName ||
        (trimmedNextName !== oldName && current.matchingGroups.includes(trimmedNextName))
      ) {
        return current;
      }

      const nextMatchingGroups = current.matchingGroups.map((groupName) =>
        groupName === oldName ? trimmedNextName : groupName,
      );

      setTileEntries((currentEntries) =>
        currentEntries.map((entry) => ({
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
      );

      return {
        ...current,
        matchingGroups: nextMatchingGroups,
      };
    });
  };

  const deleteMatchingGroup = (groupName: string) => {
    setTileset((current) => {
      if (!current?.matchingGroups) {
        return current;
      }

      const nextMatchingGroups = current.matchingGroups.filter(
        (currentGroupName) => currentGroupName !== groupName,
      );

      setTileEntries((currentEntries) =>
        currentEntries.map((entry) => {
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
      );

      return {
        ...current,
        matchingGroups: nextMatchingGroups.length > 0 ? nextMatchingGroups : undefined,
      };
    });
  };

  const updateTileMatchingGroup = (
    tileId: string,
    direction: AdjacencyDirection,
    groupName: string,
  ) => {
    setTileEntries((currentEntries) =>
      currentEntries.map((entry) => {
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
    );
  };

  const saveTileset = async () => {
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

      setSelectedFileName(fileName);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save tileset');
    }
  };

  const updatePreviewZoom = (nextZoom: number) => {
    setPreviewZoom(Math.min(6, Math.max(0.5, nextZoom)));
  };

  const selectedTileIndex = tileEntries.findIndex((entry) => entry.id === selectedTileId);
  const selectedTile = selectedTileIndex >= 0 ? tileEntries[selectedTileIndex] : null;
  const tilePendingDelete =
    tileDeleteIndex === null ? null : (tileEntries[tileDeleteIndex] ?? null);
  const materialNames = [...(tileset?.materials ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );
  const matchingGroupNames = [...(tileset?.matchingGroups ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );
  const getResolvedMatchingTiles = (tileId: string, direction: AdjacencyDirection): string[] => {
    const groupName = tileEntries.find((entry) => entry.id === tileId)?.adjacency?.[direction];
    if (!tileset || !groupName) {
      return [];
    }

    const oppositeDirection = oppositeDirections[direction];
    return tileEntries
      .map((entry) => entry.id)
      .filter((candidateTileId) => {
        const candidateGroupName = tileEntries.find((entry) => entry.id === candidateTileId)
          ?.adjacency?.[oppositeDirection];
        return candidateGroupName === groupName;
      });
  };
  const getResolvedMatchingTileEntries = (
    tileId: string,
    direction: AdjacencyDirection,
  ): TileEntry[] => {
    const resolvedTileIds = new Set(getResolvedMatchingTiles(tileId, direction));
    return tileEntries.filter((entry) => resolvedTileIds.has(entry.id));
  };
  const grid = tileset?.grid;
  const frameWidth = grid?.frameWidth ?? 32;
  const frameHeight = grid?.frameHeight ?? 32;
  const offsetX = grid?.offsetX ?? 0;
  const offsetY = grid?.offsetY ?? 0;
  const gapX = grid?.gapX ?? 0;
  const gapY = grid?.gapY ?? 0;
  const columns = grid?.columns ?? 0;
  const rows = grid?.rows ?? 0;
  const previewScale = previewZoom;
  const largestFrameSide = Math.max(1, frameWidth, frameHeight);
  const adjacencyCenterScale = Math.max(1, Math.min(6, Math.floor(128 / largestFrameSide)));
  const adjacencyMatchScale = Math.max(1, Math.min(4, Math.floor(64 / largestFrameSide)));
  const renderTileSprite = (tile: TileEntry, scale: number) => {
    if (!image) {
      return null;
    }

    const left = (offsetX + tile.column * (frameWidth + gapX)) * scale;
    const top = (offsetY + tile.row * (frameHeight + gapY)) * scale;

    return (
      <div
        className="relative shrink-0 overflow-hidden border border-slate-700 bg-slate-950"
        style={{
          height: frameHeight * scale,
          width: frameWidth * scale,
        }}
      >
        <img
          src={image.src}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            height: image.height * scale,
            imageRendering: 'pixelated',
            left: -left,
            top: -top,
            width: image.width * scale,
          }}
        />
      </div>
    );
  };
  const renderAdjacencyMatches = (direction: AdjacencyDirection) => {
    const matches = selectedTile ? getResolvedMatchingTileEntries(selectedTile.id, direction) : [];

    return (
      <div className="flex min-h-32 flex-col rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {direction}
          </div>
          <div className="text-[11px] text-slate-500">{matches.length} matches</div>
        </div>
        {matches.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {matches.map((match, index) => (
              <button
                key={`${direction}-${match.id}-${index}`}
                type="button"
                onClick={() => setSelectedTileId(match.id)}
                className="rounded-lg border border-transparent p-1 text-left transition hover:border-cyan-300/60 hover:bg-cyan-500/10"
                title={`${match.id} [${match.column}, ${match.row}]`}
              >
                {renderTileSprite(match, adjacencyMatchScale)}
                <div className="mt-1 max-w-16 truncate text-[10px] text-slate-400">
                  {match.id.trim() || 'unnamed'}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-800 px-3 py-4 text-center text-xs text-slate-600">
            No matches
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <aside className="flex h-full w-96 shrink-0 flex-col border-r border-slate-800 bg-slate-950/95">
        <div className="border-b border-slate-800 px-6 py-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <a
              href="/"
              className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Back Home
            </a>
            <button
              type="button"
              onClick={() => void saveTileset()}
              className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-500/20"
            >
              Save
            </button>
            <button
              type="button"
              onClick={createNewTileset}
              className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 hover:border-slate-500 hover:text-white"
            >
              New
            </button>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Spritesheet Editor
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-white">Tileset Definition</h1>
        </div>

        {tileset ? (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <CollapsibleSection
              title="Tileset"
              isOpen={isTilesetSectionOpen}
              onToggle={() => setIsTilesetSectionOpen((current) => !current)}
            >
              <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Tileset JSON
                  <select
                    value={selectedFileName}
                    onChange={(event) => selectTileset(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                  >
                    {selectedFileName ? null : <option value="">Unsaved new tileset</option>}
                    {selectedFileName &&
                    !editorBundledTilesets.some((entry) => entry.fileName === selectedFileName) ? (
                      <option value={selectedFileName}>{selectedFileName}</option>
                    ) : null}
                    {editorBundledTilesets.map((entry) => (
                      <option key={entry.fileName} value={entry.fileName}>
                        {entry.fileName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Id
                  <input
                    value={tileset.id}
                    onChange={(event) =>
                      setTileset((current) =>
                        current ? { ...current, id: event.target.value } : current,
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                  />
                </label>

                <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  PNG Asset
                  <select
                    value={tileset.imageSrc}
                    onChange={(event) =>
                      setTileset((current) =>
                        current ? { ...current, imageSrc: event.target.value } : current,
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                  >
                    {shipInteriorTileAssets.map((asset) => (
                      <option key={asset.imageSrc} value={asset.imageSrc}>
                        {asset.fileName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Grid"
              isOpen={isGridSectionOpen}
              onToggle={() => setIsGridSectionOpen((current) => !current)}
            >
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ['frameWidth', frameWidth],
                      ['frameHeight', frameHeight],
                      ['offsetX', offsetX],
                      ['offsetY', offsetY],
                      ['gapX', gapX],
                      ['gapY', gapY],
                      ['columns', columns],
                      ['rows', rows],
                    ] as const
                  ).map(([key, value]) => (
                    <label key={key} className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      {key}
                      <input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(event) => updateGrid(key, readNumber(event.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Preview Zoom"
              isOpen={isPreviewSectionOpen}
              onToggle={() => setIsPreviewSectionOpen((current) => !current)}
            >
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label
                    htmlFor="spritesheet-preview-zoom"
                    className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                  >
                    Preview Zoom
                  </label>
                  <span className="text-sm tabular-nums text-slate-300">
                    {Math.round(previewZoom * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updatePreviewZoom(previewZoom - 0.5)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 text-slate-200 transition hover:border-slate-500 hover:text-white"
                    aria-label="Zoom out"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M5 10h10" />
                    </svg>
                  </button>
                  <input
                    id="spritesheet-preview-zoom"
                    type="range"
                    min="50"
                    max="600"
                    step="50"
                    value={Math.round(previewZoom * 100)}
                    onChange={(event) => updatePreviewZoom(Number(event.target.value) / 100)}
                    className="min-w-0 flex-1"
                    aria-label="Preview zoom"
                  />
                  <button
                    type="button"
                    onClick={() => updatePreviewZoom(previewZoom + 0.5)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 text-slate-200 transition hover:border-slate-500 hover:text-white"
                    aria-label="Zoom in"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M10 5v10" />
                      <path d="M5 10h10" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePreviewZoom(2)}
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Tiles"
              isOpen={isTilesSectionOpen}
              onToggle={() => setIsTilesSectionOpen((current) => !current)}
            >
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs text-slate-500">{tileEntries.length} tiles</div>
                </div>
                <div className="space-y-2">
                  {tileEntries.map((entry, index) => (
                    <div
                      key={`${entry.id}-${index}`}
                      className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border p-2 transition ${
                        selectedTileId === entry.id
                          ? 'border-cyan-300 bg-cyan-500/15'
                          : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedTileId(entry.id)}
                        className="min-w-0 rounded-lg px-2 py-1 text-left transition hover:bg-slate-800/60"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-100">
                            {entry.id.trim() || 'unnamed tile'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            Column {entry.column}, row {entry.row}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTileDeleteIndex(index)}
                        className="rounded-lg px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/15"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Materials"
              isOpen={isMaterialsSectionOpen}
              onToggle={() => setIsMaterialsSectionOpen((current) => !current)}
            >
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="mb-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Material Names
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        Materials group tiles by paint intent, like floor, wall, door, or hazard.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addMaterial}
                      className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                    >
                      Add
                    </button>
                  </div>

                  {materialNames.length > 0 ? (
                    <div className="space-y-3">
                      {materialNames.map((materialName) => (
                        <div
                          key={materialName}
                          className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                        >
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                              Name
                              <input
                                defaultValue={materialName}
                                onBlur={(event) =>
                                  renameMaterial(materialName, event.currentTarget.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.currentTarget.blur();
                                  }
                                }}
                                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-400"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => deleteMaterial(materialName)}
                              className="self-end rounded-lg px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/15"
                            >
                              Delete
                            </button>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-500">
                            {
                              tileEntries.filter((entry) => entry.material === materialName).length
                            }{' '}
                            assigned tiles
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-800 p-3 text-sm text-slate-500">
                      No materials yet.
                    </div>
                  )}
                </div>

              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Matching Groups"
              isOpen={isMatchingGroupsSectionOpen}
              onToggle={() => setIsMatchingGroupsSectionOpen((current) => !current)}
            >
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs leading-5 text-slate-500">
                      A tile side connects to neighbor opposite sides with the same group.
                    </div>
                    <button
                      type="button"
                      onClick={addMatchingGroup}
                      className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                    >
                      Add
                    </button>
                  </div>

                  {matchingGroupNames.length > 0 ? (
                    <div className="space-y-3">
                      {matchingGroupNames.map((groupName) => (
                        <div
                          key={groupName}
                          className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                        >
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                              Name
                              <input
                                defaultValue={groupName}
                                onBlur={(event) =>
                                  renameMatchingGroup(groupName, event.currentTarget.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.currentTarget.blur();
                                  }
                                }}
                                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-400"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => deleteMatchingGroup(groupName)}
                              className="self-end rounded-lg px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/15"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-800 p-3 text-sm text-slate-500">
                      No matching groups yet.
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Tile Properties"
              isOpen={isTilePropertiesSectionOpen}
              onToggle={() => setIsTilePropertiesSectionOpen((current) => !current)}
            >
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={addTileEntry}
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    Add
                  </button>
                </div>

                {selectedTile ? (
                  <div className="space-y-4">
                    <div className="text-sm text-slate-300">
                      Editing{' '}
                      <span className="font-semibold text-cyan-200">
                        {selectedTile.id.trim() || 'unnamed tile'}
                      </span>
                    </div>

                    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Tile
                      </div>

                      <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        ID
                        <input
                          value={selectedTile.id}
                          onChange={(event) =>
                            updateTileId(selectedTileIndex, event.currentTarget.value)
                          }
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          Column
                          <input
                            type="number"
                            min="0"
                            value={selectedTile.column}
                            onChange={(event) =>
                              updateTileEntry(selectedTileIndex, {
                                column: readNumber(event.currentTarget.value),
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                          />
                        </label>
                        <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          Row
                          <input
                            type="number"
                            min="0"
                            value={selectedTile.row}
                            onChange={(event) =>
                              updateTileEntry(selectedTileIndex, {
                                row: readNumber(event.currentTarget.value),
                              })
                            }
                            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                          />
                        </label>
                      </div>

                      <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Material
                        <select
                          value={selectedTile.material ?? ''}
                          onChange={(event) =>
                            updateTileMaterial(selectedTile.id, event.currentTarget.value)
                          }
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                        >
                          <option value="">No material</option>
                          {materialNames.map((materialName) => (
                            <option key={materialName} value={materialName}>
                              {materialName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Tile Side Groups
                      </div>
                      {adjacencyDirections.map((direction) => {
                        const resolvedTiles = getResolvedMatchingTiles(selectedTile.id, direction);
                        return (
                          <label
                            key={direction}
                            className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                          >
                            {direction}
                            <select
                              value={selectedTile.adjacency?.[direction] ?? ''}
                              onChange={(event) =>
                                updateTileMatchingGroup(
                                  selectedTile.id,
                                  direction,
                                  event.target.value,
                                )
                              }
                              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
                            >
                              <option value="">No group</option>
                              {matchingGroupNames.map((groupName) => (
                                <option key={groupName} value={groupName}>
                                  {groupName}
                                </option>
                              ))}
                            </select>
                            <div className="mt-1 text-[11px] normal-case leading-4 tracking-normal text-slate-500">
                              Matches {oppositeDirections[direction]} side of:{' '}
                              {resolvedTiles.length > 0 ? resolvedTiles.join(', ') : 'none'}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <p className="text-xs leading-5 text-slate-500">
                      Empty side groups do not constrain that side.
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    Select a tile to edit its properties.
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-400">No tileset JSON files found.</div>
        )}
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden bg-slate-950 p-8">
        <div className="flex h-full min-h-0 w-full flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50">
          <div className="mb-4 flex items-center justify-between gap-6">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Preview
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {selectedAsset?.fileName ?? 'No PNG selected'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950/80 p-1">
                {(
                  [
                    ['sheet', 'Sheet'],
                    ['adjacency', 'Adjacency'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPreviewMode(mode)}
                    className={`rounded-lg px-3 py-1.5 text-xs transition ${
                      previewMode === mode
                        ? 'bg-cyan-500/20 text-cyan-100'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {image ? (
                <div className="text-xs text-slate-500">
                  {image.width} x {image.height}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {image && previewMode === 'sheet' ? (
              <div className="h-full w-full overflow-auto border border-slate-800 bg-slate-950">
                <div className="flex min-h-full min-w-full items-center justify-center">
                  <div
                    className="relative shrink-0"
                    style={{
                      height: image.height * previewScale,
                      width: image.width * previewScale,
                    }}
                  >
                    <img
                      src={image.src}
                      alt={tileset?.id ?? 'spritesheet'}
                      draggable={false}
                      className="absolute inset-0 max-w-none"
                      style={{
                        height: image.height * previewScale,
                        imageRendering: 'pixelated',
                        width: image.width * previewScale,
                      }}
                    />
                    {Array.from({ length: Math.max(0, rows) }).flatMap((_, row) =>
                      Array.from({ length: Math.max(0, columns) }).map((__, column) => {
                        const left = (offsetX + column * (frameWidth + gapX)) * previewScale;
                        const top = (offsetY + row * (frameHeight + gapY)) * previewScale;
                        const tile = tileEntries.find(
                          (entry) => entry.column === column && entry.row === row,
                        );
                        const isSelected =
                          selectedTile?.column === column && selectedTile.row === row;
                        return (
                          <button
                            key={`${column}-${row}`}
                            type="button"
                            onClick={() => {
                              if (tile) {
                                setSelectedTileId(tile.id);
                              }
                            }}
                            className={`absolute border bg-transparent ${
                              isSelected
                                ? 'border-yellow-300 shadow-[0_0_0_2px_rgba(250,204,21,0.35)]'
                                : tile
                                  ? 'border-cyan-300/70'
                                  : 'border-slate-400/20'
                            }`}
                            style={{
                              height: frameHeight * previewScale,
                              left,
                              top,
                              width: frameWidth * previewScale,
                            }}
                            title={tile ? `${tile.id} [${column}, ${row}]` : `[${column}, ${row}]`}
                          />
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {image && previewMode === 'adjacency' ? (
              <div className="h-full w-full overflow-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                {selectedTile ? (
                  <div className="grid min-h-full min-w-[44rem] grid-cols-[minmax(10rem,1fr)_auto_minmax(10rem,1fr)] grid-rows-[auto_auto_auto] items-center gap-4">
                    <div className="col-start-2">{renderAdjacencyMatches('up')}</div>
                    <div className="col-start-1 row-start-2">
                      {renderAdjacencyMatches('left')}
                    </div>
                    <div className="col-start-2 row-start-2 flex flex-col items-center justify-center gap-3 rounded-2xl border border-cyan-300/50 bg-cyan-500/10 p-5">
                      {renderTileSprite(selectedTile, adjacencyCenterScale)}
                      <div className="max-w-44 text-center">
                        <div className="truncate text-sm font-semibold text-cyan-100">
                          {selectedTile.id.trim() || 'unnamed tile'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Column {selectedTile.column}, row {selectedTile.row}
                        </div>
                      </div>
                    </div>
                    <div className="col-start-3 row-start-2">
                      {renderAdjacencyMatches('right')}
                    </div>
                    <div className="col-start-2 row-start-3">{renderAdjacencyMatches('down')}</div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Select a tile to preview adjacency matches.
                  </div>
                )}
              </div>
            ) : null}

            {!image ? (
              <div className="flex h-full w-full items-center justify-center border border-slate-800 bg-slate-950 text-sm text-slate-500">
                No spritesheet image loaded.
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <ConfirmationDialog
        isOpen={tilePendingDelete !== null}
        title="Delete tile?"
        message={`This will remove ${
          tilePendingDelete?.id.trim() || 'this tile'
        } from the current tileset.`}
        confirmLabel="Delete"
        onCancel={() => setTileDeleteIndex(null)}
        onConfirm={() => {
          if (tileDeleteIndex !== null) {
            deleteTileEntry(tileDeleteIndex);
          }
        }}
      />
    </div>
  );
}
