import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';

export function OutputSection({
  isSaving,
  onSave,
  saveMessage,
}: {
  isSaving: boolean;
  onSave: () => void;
  saveMessage: string | null;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Output"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <button
          type="button"
          disabled={isSaving}
          onClick={onSave}
          className="min-h-10 w-full rounded-lg border border-cyan-400/70 bg-cyan-400/15 px-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save to Game'}
        </button>
        {saveMessage ? <div className="mt-3 text-sm text-slate-300">{saveMessage}</div> : null}
      </div>
    </CollapsibleSection>
  );
}
