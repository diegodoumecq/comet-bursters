import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { Switch } from '@/ui/components/Switch';
import type { SpriteAssetGridSource } from '../assetCatalog';
import type { GridSettings } from '../state/spriteEditorStore';

export function GridSection({
  applyGridSource,
  gridColor,
  gridOpacity,
  gridSettings,
  isGridVisible,
  matchingGridSources,
  setGridColor,
  setGridOpacity,
  setIsGridVisible,
  updateGridNumber,
}: {
  applyGridSource: (source: SpriteAssetGridSource) => void;
  gridColor: string;
  gridOpacity: number;
  gridSettings: GridSettings;
  isGridVisible: boolean;
  matchingGridSources: SpriteAssetGridSource[];
  setGridColor: (gridColor: string) => void;
  setGridOpacity: (gridOpacity: number) => void;
  setIsGridVisible: (isGridVisible: boolean) => void;
  updateGridNumber: (key: keyof GridSettings, value: string, required?: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection title="Grid" isOpen={isOpen} onToggle={() => setIsOpen((current) => !current)}>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-300">Overlay and tileset frame settings</div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Show</span>
            <Switch checked={isGridVisible} onCheckedChange={setIsGridVisible} />
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
            <span className="min-w-16 uppercase tracking-[0.16em] text-slate-500">Color</span>
            <input
              type="color"
              value={gridColor}
              onChange={(event) => setGridColor(event.currentTarget.value)}
              className="h-8 w-8 rounded border-0 bg-transparent p-0"
            />
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={gridOpacity}
              onChange={(event) => setGridOpacity(Number(event.currentTarget.value))}
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
                onChange={(event) => updateGridNumber('frameWidth', event.currentTarget.value, true)}
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
                  updateGridNumber('frameHeight', event.currentTarget.value, true)
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
                onChange={(event) => updateGridNumber('offsetX', event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Offset Y</div>
              <input
                type="number"
                min="0"
                value={gridSettings.offsetY ?? ''}
                onChange={(event) => updateGridNumber('offsetY', event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Gap X</div>
              <input
                type="number"
                min="0"
                value={gridSettings.gapX ?? ''}
                onChange={(event) => updateGridNumber('gapX', event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Gap Y</div>
              <input
                type="number"
                min="0"
                value={gridSettings.gapY ?? ''}
                onChange={(event) => updateGridNumber('gapY', event.currentTarget.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </label>
            <label className="col-span-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <div className="uppercase tracking-[0.16em] text-slate-500">Frame Count</div>
              <input
                type="number"
                min="0"
                value={gridSettings.frameCount ?? ''}
                onChange={(event) => updateGridNumber('frameCount', event.currentTarget.value)}
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
