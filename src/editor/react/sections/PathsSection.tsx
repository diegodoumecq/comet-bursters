import { useState } from 'react';

import { useEditorStore } from '../../state/editorStore';
import { CollapsibleSection } from '../components/CollapsibleSection';

export function PathsSection({
  onScrollIntoView,
}: {
  onScrollIntoView: (x: number, y: number) => void;
}) {
  const deletePath = useEditorStore((state) => state.deletePath);
  const level = useEditorStore((state) => state.level);
  const openPathMenuId = useEditorStore((state) => state.openPathMenuId);
  const renamingPathId = useEditorStore((state) => state.renamingPathId);
  const renamingPathValue = useEditorStore((state) => state.renamingPathValue);
  const savePathRename = useEditorStore((state) => state.savePathRename);
  const setOpenPathMenuId = useEditorStore((state) => state.setOpenPathMenuId);
  const setRenamingPathId = useEditorStore((state) => state.setRenamingPathId);
  const setRenamingPathValue = useEditorStore((state) => state.setRenamingPathValue);
  const selectedPathId = useEditorStore((state) => state.selectedPathId);
  const setSelectedPathId = useEditorStore((state) => state.setSelectedPathId);
  const setLevel = useEditorStore((state) => state.setLevel);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Paths"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
        <div>{level.paths.length} paths in level</div>
        <div className="mt-2">Path mode is now separated from entity placement in the sidebar.</div>
        <div className="mt-2">Use the `...` button on a path row to rename it.</div>
      </div>
      <div className="grid gap-2">
        {level.paths.map((path) => (
          <div
            key={path.id}
            onClick={() => {
              setSelectedPathId(path.id);
              if (path.patrol.length > 0) {
                const centerX =
                  path.patrol.reduce((sum, point) => sum + point.x, 0) / path.patrol.length;
                const centerY =
                  path.patrol.reduce((sum, point) => sum + point.y, 0) / path.patrol.length;
                onScrollIntoView(centerX, centerY);
              }
            }}
            className={`relative cursor-pointer rounded-xl border px-3 py-2 text-sm transition ${
              selectedPathId === path.id
                ? 'border-cyan-300 bg-cyan-500/10 text-slate-100'
                : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {renamingPathId === path.id ? (
                  <input
                    autoFocus
                    value={renamingPathValue}
                    onChange={(event) => setRenamingPathValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        savePathRename(path.id);
                      }
                      if (event.key === 'Escape') {
                        setRenamingPathId(null);
                        setRenamingPathValue('');
                      }
                    }}
                    className="w-full rounded-lg border border-amber-300 bg-slate-950/90 px-2 py-1 text-sm text-slate-100 outline-none"
                  />
                ) : (
                  <div className="truncate font-medium text-slate-100">{path.id}</div>
                )}
              </div>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenPathMenuId(openPathMenuId === path.id ? null : path.id);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                >
                  ...
                </button>
                {openPathMenuId === path.id ? (
                  <div className="absolute right-0 top-9 z-10 min-w-28 rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingPathId(path.id);
                        setRenamingPathValue(path.id);
                        setOpenPathMenuId(null);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePath(path.id)}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-500/15"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="text-xs text-slate-500">{path.patrol.length} patrol points</div>
            {selectedPathId === path.id ? (
              <label
                className="mt-3 flex items-center gap-2 text-xs text-slate-300"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={path.closed ?? false}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setLevel((currentLevel) => ({
                      ...currentLevel,
                      paths: currentLevel.paths.map((candidate) =>
                        candidate.id === path.id ? { ...candidate, closed: checked } : candidate,
                      ),
                    }));
                  }}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950/80 text-cyan-400"
                />
                Closed path
              </label>
            ) : null}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
