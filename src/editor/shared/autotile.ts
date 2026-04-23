export const cardinalTopologyDirections = ['up', 'right', 'down', 'left'] as const;
export const diagonalTopologyDirections = [
  'upRight',
  'downRight',
  'downLeft',
  'upLeft',
] as const;
export const topologyDirections = [
  ...cardinalTopologyDirections,
  ...diagonalTopologyDirections,
] as const;

export type TileTopologyDirection = (typeof topologyDirections)[number];
export type TileTopologyRelation = 'same' | 'different' | 'any';
export type TileTopology = Partial<Record<TileTopologyDirection, TileTopologyRelation>>;

export const topologyDirectionOffsets: Record<TileTopologyDirection, { dx: number; dy: number }> =
  {
    up: { dx: 0, dy: -1 },
    right: { dx: 1, dy: 0 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    upRight: { dx: 1, dy: -1 },
    downRight: { dx: 1, dy: 1 },
    downLeft: { dx: -1, dy: 1 },
    upLeft: { dx: -1, dy: -1 },
  };

export function normalizeTileTopologyRelation(value: unknown): TileTopologyRelation | undefined {
  return value === 'same' || value === 'different' || value === 'any' ? value : undefined;
}

export function cloneTileTopology(topology: TileTopology | undefined): TileTopology | undefined {
  return topology ? { ...topology } : undefined;
}

export function getTileTopologyRelation(
  topology: TileTopology | undefined,
  direction: TileTopologyDirection,
): TileTopologyRelation {
  return topology?.[direction] ?? 'any';
}

export function getTileTopologySpecificity(topology: TileTopology | undefined): number {
  return topologyDirections.reduce(
    (specificity, direction) =>
      specificity + (getTileTopologyRelation(topology, direction) === 'any' ? 0 : 1),
    0,
  );
}

export function pruneTileTopology(topology: TileTopology | undefined): TileTopology | undefined {
  if (!topology) {
    return undefined;
  }

  return Object.fromEntries(
    topologyDirections.flatMap((direction) => {
      const relation = normalizeTileTopologyRelation(topology[direction]);
      return relation && relation !== 'any' ? [[direction, relation] as const] : [];
    }),
  ) as TileTopology;
}

export function tileTopologiesEqual(
  left: TileTopology | undefined,
  right: TileTopology | undefined,
): boolean {
  return topologyDirections.every(
    (direction) =>
      getTileTopologyRelation(left, direction) === getTileTopologyRelation(right, direction),
  );
}

export function getTileVariantWeight(weight: number | undefined): number {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
    return 1;
  }

  return weight;
}
