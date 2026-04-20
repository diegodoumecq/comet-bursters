import { useState } from 'react';

import { CollapsibleSection } from '../components/CollapsibleSection';
import { useEditorStore } from '../../state/editorStore';

export function ToolSwitcher() {
  const onChange = useEditorStore((state) => state.setTool);
  const tool = useEditorStore((state) => state.tool);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Tool"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="grid grid-cols-4 gap-3">
        {(['select', 'tiles', 'entities', 'paths'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-xl border px-3 py-2 text-sm capitalize ${
              tool === option
                ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                : 'border-slate-700 bg-slate-950/80 text-slate-300 hover:border-slate-500'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </CollapsibleSection>
  );
}
