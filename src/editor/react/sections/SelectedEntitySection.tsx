import { useState } from 'react';

import { useEditorStore } from '../../state/editorStore';
import { CollapsibleSection } from '../components/CollapsibleSection';

export function SelectedEntitySection() {
  const deleteSelectedEntity = useEditorStore((state) => state.deleteSelectedEntity);
  const level = useEditorStore((state) => state.level);
  const selectedEntityId = useEditorStore((state) => state.selectedEntityId);
  const selectedEntity = useEditorStore((state) =>
    state.level.entities.find((entity) => entity.id === selectedEntityId) ?? null,
  );
  const updateSelectedEntity = useEditorStore((state) => state.updateSelectedEntity);
  const updateSelectedEntityType = useEditorStore((state) => state.updateSelectedEntityType);
  const [isOpen, setIsOpen] = useState(true);

  if (!selectedEntity) {
    return null;
  }

  return (
    <CollapsibleSection
      title="Selected Entity"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Id
          </div>
          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200">
            {selectedEntity.id}
          </div>
        </div>
        <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Type
          <select
            value={selectedEntity.type}
            onChange={(event) => updateSelectedEntityType(event.target.value as 'player' | 'enemy-patroller')}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
          >
            <option value="player">player</option>
            <option value="enemy-patroller">enemy-patroller</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            X
            <input
              type="number"
              value={selectedEntity.x}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(value)) {
                  updateSelectedEntity({ x: value });
                }
              }}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </label>
          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Y
            <input
              type="number"
              value={selectedEntity.y}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(value)) {
                  updateSelectedEntity({ y: value });
                }
              }}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </label>
        </div>
        {selectedEntity.type === 'enemy-patroller' ? (
          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Path
            <select
              value={selectedEntity.pathId ?? ''}
              onChange={(event) => updateSelectedEntity({ pathId: event.target.value || undefined })}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
            >
              <option value="">None</option>
              {level.paths.map((path) => (
                <option key={path.id} value={path.id}>
                  {path.id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          onClick={deleteSelectedEntity}
          className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 hover:bg-rose-500/20"
        >
          Delete Entity
        </button>
      </div>
    </CollapsibleSection>
  );
}
