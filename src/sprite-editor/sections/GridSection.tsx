import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { Switch } from '@/ui/components/Switch';
import type { SpriteAssetGridSource } from '../assetCatalog';
import { normalizeGridSettings, useSpriteEditorStore } from '../state/spriteEditorStore';

export function GridSection({
  matchingGridSources,
}: {
  matchingGridSources: SpriteAssetGridSource[];
}) {
  const [isOpen, setIsOpen] = useState(true);
  const gridColor = useSpriteEditorStore((state) => state.gridColor);
  const gridOpacity = useSpriteEditorStore((state) => state.gridOpacity);
  const gridSettings = useSpriteEditorStore((state) => state.gridSettings);
  const isGridVisible = useSpriteEditorStore((state) => state.isGridVisible);
  const handlers = useSpriteEditorStore((state) => state.handlers);

  const applyGridSource = (source: SpriteAssetGridSource, options?: { announce?: boolean; makeVisible?: boolean }) => {
    handlers.applyGridSettings(normalizeGridSettings(source.grid));
    if (options?.makeVisible ?? true) {
      handlers.setIsGridVisible(true);
    }
    if (options?.announce ?? true) {
      handlers.setMessage(`Loaded grid from ${source.id}.`);
    }
    handlers.setLoadError(null);
  };

  return (
    <CollapsibleSection title="Grid" isOpen={isOpen} onToggle={() => setIsOpen((current) => !current)}>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-300">Overlay and tileset frame settings</div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Show</span>
            <Switch checked={isGridVisible} onCheckedChange={handlers.setIsGridVisible} />
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            <span className="min-w-16 uppercase tracking-[0.16em] text-slate-500">Color</span>
            <input
              type="color"
              value={gridColor}
              onChange={(event) => handlers.setGridColor(event.currentTarget.value)}
              className="h-8 w-8 rounded border-0 bg-transparent p-0"
            />
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={gridOpacity}
              onChange={(event) => handlers.setGridOpacity(Number(event.currentTarget.value))}
              className="flex-1"
            />
            <span className="w-10 text-right text-slate-100">
              {Math.round(gridOpacity * 100)}%
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Frame Width</div>
              <input
                type="number"
                min="1"
                value={gridSettings.frameWidth}
                onChange={(event) =>
                  handlers.updateGridNumber('frameWidth', event.currentTarget.value, true)
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Frame Height</div>
              <input
                type="number"
                min="1"
                value={gridSettings.frameHeight}
                onChange={(event) =>
                  handlers.updateGridNumber('frameHeight', event.currentTarget.value, true)
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Offset X</div>
              <input
                type="number"
                min="0"
                value={gridSettings.offsetX ?? ''}
                onChange={(event) => handlers.updateGridNumber('offsetX', event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Offset Y</div>
              <input
                type="number"
                min="0"
                value={gridSettings.offsetY ?? ''}
                onChange={(event) => handlers.updateGridNumber('offsetY', event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Gap X</div>
              <input
                type="number"
                min="0"
                value={gridSettings.gapX ?? ''}
                onChange={(event) => handlers.updateGridNumber('gapX', event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Gap Y</div>
              <input
                type="number"
                min="0"
                value={gridSettings.gapY ?? ''}
                onChange={(event) => handlers.updateGridNumber('gapY', event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="col-span-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Frame Count</div>
              <input
                type="number"
                min="0"
                value={gridSettings.frameCount ?? ''}
                onChange={(event) =>
                  handlers.updateGridNumber('frameCount', event.currentTarget.value)
                }
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Tileset Presets
            </div>
            {matchingGridSources.length > 0 ? (
              <div className="mt-3 space-y-2">
                {matchingGridSources.map((source) => (
                  <button
                    key={`${source.sourcePath}:${source.id}`}
                    type="button"
                    onClick={() => applyGridSource(source)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-left transition hover:border-slate-600"
                  >
                    <div className="text-sm text-slate-100">{source.id}</div>
                    <div className="mt-1 text-xs text-slate-500">{source.sourcePath}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">
                No matching `.tileset.json` found for this image.
              </div>
            )}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
