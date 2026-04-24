import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { readNumber, useSpritesheetEditorStore } from '../state/spritesheetEditorStore';

export function GridSection() {
  const tileset = useSpritesheetEditorStore((state) => state.tileset);
  const updateGrid = useSpritesheetEditorStore((state) => state.updateGrid);
  const [isOpen, setIsOpen] = useState(true);
  const grid = tileset?.grid;
  const frameWidth = grid?.frameWidth ?? 32;
  const frameHeight = grid?.frameHeight ?? 32;
  const offsetX = grid?.offsetX ?? 0;
  const offsetY = grid?.offsetY ?? 0;
  const gapX = grid?.gapX ?? 0;
  const gapY = grid?.gapY ?? 0;

  return (
    <CollapsibleSection
      title="Grid"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['frameWidth', frameWidth],
              ['frameHeight', frameHeight],
              ['offsetX', offsetX],
              ['offsetY', offsetY],
              ['gapX', gapX],
              ['gapY', gapY],
            ] as const
          ).map(([key, value]) => (
            <label key={key} className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {key}
              <input
                type="number"
                min="0"
                value={value}
                onChange={(event) => updateGrid(key, readNumber(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </label>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}
