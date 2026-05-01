import {
  getTileTopologyRelation,
  type TileTopology,
  type TileTopologyDirection,
  type TileTopologyRelation,
} from '../../editor/shared/autotile';
import type { TileEntry } from '../state/spritesheetEditorStore';

const topologyDirectionLabel: Record<TileTopologyDirection, string> = {
  up: 'Up',
  right: 'Right',
  down: 'Down',
  left: 'Left',
  upRight: 'Up Right',
  downRight: 'Down Right',
  downLeft: 'Down Left',
  upLeft: 'Up Left',
};

export function TopologyCell({
  direction,
  selectedTile,
  topology,
  updateTileTopologyRelation,
}: {
  direction: TileTopologyDirection;
  selectedTile: TileEntry | null;
  topology: TileTopology | undefined;
  updateTileTopologyRelation: (
    tileId: number,
    direction: TileTopologyDirection,
    relation: TileTopologyRelation,
  ) => void;
}) {
  const relation = getTileTopologyRelation(topology, direction);
  const toneClassName =
    relation === 'same'
      ? 'border-cyan-300/40 bg-cyan-500/10 text-cyan-100'
      : relation === 'different'
        ? 'border-rose-300/30 bg-rose-500/10 text-rose-100'
        : 'border-amber-300/30 bg-amber-500/10 text-amber-100';

  return (
    <div className={`flex min-h-24 flex-col justify-between rounded-xl border p-3 ${toneClassName}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
        {topologyDirectionLabel[direction]}
      </div>
      {selectedTile ? (
        <select
          value={relation}
          onChange={(event) =>
            updateTileTopologyRelation(
              selectedTile.id,
              direction,
              event.currentTarget.value as TileTopologyRelation,
            )
          }
          className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 outline-none transition focus:border-cyan-400"
        >
          <option value="any">Any</option>
          <option value="same">Same</option>
          <option value="different">Different</option>
        </select>
      ) : (
        <div className="text-sm font-medium capitalize">{relation}</div>
      )}
    </div>
  );
}
