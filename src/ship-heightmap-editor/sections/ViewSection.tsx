import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import type { RenderMode } from '../types';

const RENDER_MODES: Array<{ key: RenderMode; label: string }> = [
  { key: 'height', label: 'Height' },
  { key: 'material', label: 'Material' },
  { key: 'normal', label: 'Normals' },
  { key: 'lit', label: 'Lit' },
  { key: 'alpha', label: 'Alpha' },
];

export function ViewSection({
  mode,
  onModeChange,
}: {
  mode: RenderMode;
  onModeChange: (mode: RenderMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="View"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-2 gap-2">
          {RENDER_MODES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => onModeChange(entry.key)}
              className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition ${
                mode === entry.key
                  ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100'
                  : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}
