import { useState } from 'react';

import { bundledLevels } from '../../shared/levelCatalog';
import { useEditorStore } from '../../state/editorStore';
import { CollapsibleSection } from '../components/CollapsibleSection';

export function LevelSection({
  onCanvasZoomChange,
  zoom,
}: {
  onCanvasZoomChange: (zoom: number) => void;
  zoom: number;
}) {
  const importLevelFromText = useEditorStore((state) => state.importLevelFromText);
  const loadBundledLevel = useEditorStore((state) => state.loadBundledLevel);
  const selectedLevelAssetPath = useEditorStore((state) => state.selectedLevelAssetPath);
  const height = useEditorStore((state) => state.level.height);
  const width = useEditorStore((state) => state.level.width);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Level"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
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
      <div className="mt-1 text-xs text-slate-500">
        {width} x {height}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label
            htmlFor="editor-canvas-zoom"
            className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
          >
            Canvas Zoom
          </label>
          <span className="text-sm tabular-nums text-slate-300">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCanvasZoomChange(zoom - 0.25)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 text-slate-200 transition hover:border-slate-500 hover:text-white"
            aria-label="Zoom out"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 10h10" />
            </svg>
          </button>
          <input
            id="editor-canvas-zoom"
            type="range"
            min="25"
            max="300"
            step="25"
            value={Math.round(zoom * 100)}
            onChange={(event) => onCanvasZoomChange(Number(event.target.value) / 100)}
            className="min-w-0 flex-1"
            aria-label="Canvas zoom"
          />
          <button
            type="button"
            onClick={() => onCanvasZoomChange(zoom + 0.25)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/80 text-slate-200 transition hover:border-slate-500 hover:text-white"
            aria-label="Zoom in"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M10 5v10" />
              <path d="M5 10h10" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onCanvasZoomChange(1)}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Reset
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
