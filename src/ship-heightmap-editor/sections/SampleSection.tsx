import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { formatNumber } from '../sectionUtils';
import type { HoverSample } from '../types';

export function SampleSection({ hoverSample }: { hoverSample: HoverSample | null }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Sample"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        {hoverSample ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-slate-500">Pixel</dt>
            <dd className="text-right text-slate-200">
              {hoverSample.canvas.x}, {hoverSample.canvas.y}
            </dd>
            <dt className="text-slate-500">Point</dt>
            <dd className="text-right text-slate-200">
              {formatNumber(hoverSample.point.x)}, {formatNumber(hoverSample.point.y)}
            </dd>
            <dt className="text-slate-500">Height</dt>
            <dd className="text-right text-slate-200">{formatNumber(hoverSample.sample.height)}</dd>
            <dt className="text-slate-500">Alpha</dt>
            <dd className="text-right text-slate-200">{formatNumber(hoverSample.sample.alpha)}</dd>
            <dt className="text-slate-500">Edge</dt>
            <dd className="text-right text-slate-200">
              {formatNumber(hoverSample.sample.edgeDistance)}
            </dd>
            <dt className="text-slate-500">Material</dt>
            <dd className="text-right text-slate-200">{hoverSample.sample.material}</dd>
          </dl>
        ) : (
          <div className="text-sm text-slate-500">No pixel selected</div>
        )}
      </div>
    </CollapsibleSection>
  );
}
