import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { useSpritesheetEditorStore } from '../state/spritesheetEditorStore';

export function MaterialsSection() {
  const addMaterial = useSpritesheetEditorStore((state) => state.addMaterial);
  const deleteMaterial = useSpritesheetEditorStore((state) => state.deleteMaterial);
  const renameMaterial = useSpritesheetEditorStore((state) => state.renameMaterial);
  const tileEntries = useSpritesheetEditorStore((state) => state.tileEntries);
  const tileset = useSpritesheetEditorStore((state) => state.tileset);
  const [isOpen, setIsOpen] = useState(true);
  const materialNames = [...(tileset?.materials ?? [])].sort((left, right) =>
    left.localeCompare(right),
  );

  return (
    <CollapsibleSection
      title="Materials"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
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
                        onBlur={(event) => renameMaterial(materialName, event.currentTarget.value)}
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
                    {tileEntries.filter((entry) => entry.material === materialName).length} assigned
                    tiles
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
  );
}
