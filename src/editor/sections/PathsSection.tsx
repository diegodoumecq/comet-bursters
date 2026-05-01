import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { useEditorStore } from '../state/editorStore';
import type { RawShipInteriorLevel } from '../../scenes/ShipInteriorScene/level';
import { PathActionsMenu } from './PathActionsMenu';

function makePathId(level: RawShipInteriorLevel): string {
  let nextIndex = level.paths.length + 1;
  let nextId = `path-${nextIndex}`;

  while (level.paths.some((path) => path.id === nextId)) {
    nextIndex += 1;
    nextId = `path-${nextIndex}`;
  }

  return nextId;
}

export function PathsSection({
  onScrollIntoView,
}: {
  onScrollIntoView: (x: number, y: number) => void;
}) {
  const {
    deletePath,
    savePathRename,
    setLevel,
    setOpenPathMenuId,
    setRenamingPathId,
    setRenamingPathValue,
    setSelectedPathId,
  } = useEditorStore((state) => state.handlers);
  const level = useEditorStore((state) => state.level);
  const openPathMenuId = useEditorStore((state) => state.openPathMenuId);
  const renamingPathId = useEditorStore((state) => state.renamingPathId);
  const renamingPathValue = useEditorStore((state) => state.renamingPathValue);
  const selectedPathId = useEditorStore((state) => state.selectedPathId);
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
        <button
          type="button"
          onClick={() => {
            const nextPathId = makePathId(level);
            setLevel((currentLevel) => ({
              ...currentLevel,
              paths: [{ id: nextPathId, closed: false, patrol: [] }, ...currentLevel.paths],
            }));
            setSelectedPathId(nextPathId);
            setOpenPathMenuId(null);
            setRenamingPathId(nextPathId);
            setRenamingPathValue(nextPathId);
          }}
          className="flex items-center gap-3 rounded-xl border border-dashed border-cyan-400/40 bg-cyan-500/5 px-4 py-3 text-left text-sm text-cyan-100 transition hover:border-cyan-300/70 hover:bg-cyan-500/10"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/40 bg-slate-950/80">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 4v12" />
              <path d="M4 10h12" />
            </svg>
          </span>
          <span>
            <span className="block font-medium">Create path</span>
          </span>
        </button>
        {level.paths.map((path) => {
          const isUsed = level.entities.some((entity) => entity.pathId === path.id);
          const selectPath = () => {
            setSelectedPathId(path.id);
            if (path.patrol.length > 0) {
              const centerX =
                path.patrol.reduce((sum, point) => sum + point.x, 0) / path.patrol.length;
              const centerY =
                path.patrol.reduce((sum, point) => sum + point.y, 0) / path.patrol.length;
              onScrollIntoView(centerX, centerY);
            }
          };

          return (
            <div
              key={path.id}
              className={`relative rounded-xl border px-3 py-2 text-sm transition ${
                selectedPathId === path.id
                  ? 'border-cyan-300 bg-cyan-500/10 text-slate-100'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              {renamingPathId !== path.id ? (
                <button
                  type="button"
                  onClick={selectPath}
                  className="absolute inset-0 rounded-xl"
                  aria-label={`Select path ${path.id}`}
                />
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
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
                      className="pointer-events-auto w-full rounded-lg border border-amber-300 bg-slate-950/90 px-2 py-1 text-sm text-slate-100 outline-none"
                    />
                  ) : (
                    <div className="flex w-full min-w-0 flex-col items-start gap-1 text-left">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-slate-100">{path.id}</span>
                        {!isUsed ? (
                          <span
                            className="group pointer-events-auto relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200"
                            aria-label="Unused path"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M10 3 18 17H2L10 3Z" />
                              <path d="M10 8v4" />
                              <path d="M10 15h.01" />
                            </svg>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-1/2 top-7 z-20 hidden w-48 -translate-x-1/2 rounded-lg border border-amber-400/30 bg-slate-950 px-3 py-2 text-left text-xs font-normal text-amber-100 shadow-xl group-hover:block group-focus-within:block"
                            >
                              This path is not assigned to any entity.
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-slate-500">
                        {path.patrol.length} patrol points
                      </span>
                    </div>
                  )}
                </div>
                <div className="relative z-20 shrink-0">
                  <PathActionsMenu
                    isOpen={openPathMenuId === path.id}
                    onClose={() => setOpenPathMenuId(null)}
                    onDelete={() => deletePath(path.id)}
                    onRename={() => {
                      setRenamingPathId(path.id);
                      setRenamingPathValue(path.id);
                      setOpenPathMenuId(null);
                    }}
                    onToggle={() => setOpenPathMenuId(openPathMenuId === path.id ? null : path.id)}
                  />
                </div>
              </div>
              {selectedPathId === path.id ? (
                <label
                  className="relative z-20 mt-3 flex items-center gap-2 text-xs text-slate-300"
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
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
