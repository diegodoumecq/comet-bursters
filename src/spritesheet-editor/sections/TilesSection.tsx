import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { useSpritesheetEditorStore } from '../state/spritesheetEditorStore';

export function TilesSection() {
  const selectedTileId = useSpritesheetEditorStore((state) => state.selectedTileId);
  const setSelectedTileId = useSpritesheetEditorStore((state) => state.setSelectedTileId);
  const setTileDeleteIndex = useSpritesheetEditorStore((state) => state.setTileDeleteIndex);
  const tileEntries = useSpritesheetEditorStore((state) => state.tileEntries);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Tiles"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
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
                    {entry.name?.trim() || `tile_${entry.id}`}
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
  );
}
