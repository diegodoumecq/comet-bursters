import { useState } from 'react';

import { bundledLevels } from '../../shared/levelCatalog';
import { useEditorStore } from '../../state/editorStore';
import { CollapsibleSection } from '../components/CollapsibleSection';

export function LevelSection() {
  const importLevelFromText = useEditorStore((state) => state.importLevelFromText);
  const loadBundledLevel = useEditorStore((state) => state.loadBundledLevel);
  const onExport = useEditorStore((state) => state.exportToClipboard);
  const selectedLevelAssetPath = useEditorStore((state) => state.selectedLevelAssetPath);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Level"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Bundled Level
          </div>
          <div className="mt-2 flex gap-3">
            <select
              value={selectedLevelAssetPath ?? ''}
              onChange={(event) => loadBundledLevel(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
            >
              <option value="" disabled>
                Select level file
              </option>
              {bundledLevels.map((entry) => (
                <option key={entry.assetPath} value={entry.assetPath}>
                  {entry.fileName}
                </option>
              ))}
            </select>
            <label
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/80 text-slate-200 hover:border-slate-500"
              title="Import JSON"
              aria-label="Import JSON"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
                <path d="M12 17V11" />
                <path d="M9.5 13.5 12 11l2.5 2.5" />
              </svg>
              <span className="sr-only">Import JSON</span>
              <input
                className="hidden"
                type="file"
                accept="application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  importLevelFromText(await file.text(), file.name);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onExport}
            className="w-full rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/20"
          >
            Copy JSON
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
