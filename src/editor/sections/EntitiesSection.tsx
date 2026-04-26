import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { useEditorStore } from '../state/editorStore';

export function EntitiesSection() {
  const level = useEditorStore((state) => state.level);
  const selectedEntityPathId = useEditorStore((state) => state.selectedEntityPathId);
  const selectedEntityType = useEditorStore((state) => state.selectedEntityType);
  const setSelectedEntityPathId = useEditorStore((state) => state.setSelectedEntityPathId);
  const setSelectedEntityType = useEditorStore((state) => state.setSelectedEntityType);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Entities"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="grid grid-cols-3 gap-3">
        {(['player', 'enemy-patroller', 'column'] as const).map((entityType) => (
          <button
            key={entityType}
            type="button"
            onClick={() => setSelectedEntityType(entityType)}
            className={`rounded-xl border px-3 py-2 text-sm ${
              selectedEntityType === entityType
                ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                : 'border-slate-700 bg-slate-950/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            {entityType}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
        <div>{level.entities.length} entities in level</div>
        <div className="mt-2">In entity mode: left click places, right click removes nearest.</div>
        <div className="mt-2">Placing a player replaces the existing player spawn.</div>
        <div className="mt-2">Columns are static scene props rendered from their assigned sprite.</div>
      </div>
      {selectedEntityType === 'enemy-patroller' ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Path Assignment
          </label>
          <select
            value={selectedEntityPathId ?? ''}
            onChange={(event) => setSelectedEntityPathId(event.target.value || null)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          >
            <option value="">None</option>
            {level.paths.map((path) => (
              <option key={path.id} value={path.id}>
                {path.id}
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-slate-400">
            Newly placed enemies will use the selected path.
          </div>
        </div>
      ) : null}
    </CollapsibleSection>
  );
}
