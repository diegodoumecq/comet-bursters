import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { useSpritesheetEditorStore } from '../state/spritesheetEditorStore';

export function MatchingGroupsSection() {
  const addMatchingGroup = useSpritesheetEditorStore((state) => state.addMatchingGroup);
  const deleteMatchingGroup = useSpritesheetEditorStore((state) => state.deleteMatchingGroup);
  const renameMatchingGroup = useSpritesheetEditorStore((state) => state.renameMatchingGroup);
  const tileset = useSpritesheetEditorStore((state) => state.tileset);
  const updateDefaultMatchingGroup = useSpritesheetEditorStore(
    (state) => state.updateDefaultMatchingGroup,
  );
  const [isOpen, setIsOpen] = useState(true);
  const matchingGroupNames = [...(tileset?.matchingGroups ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );

  return (
    <CollapsibleSection
      title="Matching Groups"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
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

          <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Default Matching Group
            <select
              value={tileset?.defaultMatchingGroup ?? ''}
              onChange={(event) => updateDefaultMatchingGroup(event.currentTarget.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
            >
              <option value="">No default</option>
              {matchingGroupNames.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs normal-case leading-5 tracking-normal text-slate-500">
              Material paint treats empty neighbors as this matching group.
            </div>
          </label>
        </div>
      </div>
    </CollapsibleSection>
  );
}
