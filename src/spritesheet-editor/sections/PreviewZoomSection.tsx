import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { useSpritesheetEditorStore } from '../state/spritesheetEditorStore';

export function PreviewZoomSection() {
  const { updatePreviewZoom } = useSpritesheetEditorStore((state) => state.handlers);
  const previewZoom = useSpritesheetEditorStore((state) => state.previewZoom);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Preview Zoom"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label
            htmlFor="spritesheet-preview-zoom"
            className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
          >
            Preview Zoom
          </label>
          <span className="text-sm tabular-nums text-slate-300">
            {Math.round(previewZoom * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updatePreviewZoom(previewZoom - 0.5)}
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
            id="spritesheet-preview-zoom"
            type="range"
            min="50"
            max="600"
            step="50"
            value={Math.round(previewZoom * 100)}
            onChange={(event) => updatePreviewZoom(Number(event.target.value) / 100)}
            className="min-w-0 flex-1"
            aria-label="Preview zoom"
          />
          <button
            type="button"
            onClick={() => updatePreviewZoom(previewZoom + 0.5)}
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
            onClick={() => updatePreviewZoom(2)}
            className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-2 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Reset
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
