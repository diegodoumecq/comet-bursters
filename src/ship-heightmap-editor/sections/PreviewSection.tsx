import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { clamp, formatNumber } from '../sectionUtils';

export function PreviewSection({
  lightAngle,
  lightElevation,
  onLightAngleChange,
  onLightElevationChange,
  onShipRotationChange,
  shipRotation,
}: {
  lightAngle: number;
  lightElevation: number;
  onLightAngleChange: (value: number) => void;
  onLightElevationChange: (value: number) => void;
  onShipRotationChange: (updater: number | ((current: number) => number)) => void;
  shipRotation: number;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Preview"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <label className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Ship Rotation
          <input
            className="mt-2 w-full accent-cyan-300"
            min={-180}
            max={180}
            step={1}
            type="range"
            value={shipRotation}
            onChange={(event) => onShipRotationChange(Number(event.target.value))}
            onInput={(event) => onShipRotationChange(Number(event.currentTarget.value))}
          />
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-label="Rotate ship left"
            onClick={() => onShipRotationChange((current) => clamp(current - 45, -180, 180))}
            className="min-h-9 rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            -45
          </button>
          <button
            type="button"
            aria-label="Reset ship rotation"
            onClick={() => onShipRotationChange(0)}
            className="min-h-9 rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            Reset
          </button>
          <button
            type="button"
            aria-label="Rotate ship right"
            onClick={() => onShipRotationChange((current) => clamp(current + 45, -180, 180))}
            className="min-h-9 rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            +45
          </button>
        </div>
        <label className="mt-4 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Light Angle
          <input
            className="mt-2 w-full accent-cyan-300"
            min={-180}
            max={180}
            step={1}
            type="range"
            value={lightAngle}
            onChange={(event) => onLightAngleChange(Number(event.target.value))}
            onInput={(event) => onLightAngleChange(Number(event.currentTarget.value))}
          />
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-label="Rotate light left"
            onClick={() => onLightAngleChange(clamp(lightAngle - 45, -180, 180))}
            className="min-h-9 rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            -45
          </button>
          <button
            type="button"
            aria-label="Reset light angle"
            onClick={() => onLightAngleChange(-135)}
            className="min-h-9 rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            Reset
          </button>
          <button
            type="button"
            aria-label="Rotate light right"
            onClick={() => onLightAngleChange(clamp(lightAngle + 45, -180, 180))}
            className="min-h-9 rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            +45
          </button>
        </div>
        <label className="mt-4 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Light Elevation
          <input
            className="mt-2 w-full accent-cyan-300"
            min={0}
            max={1}
            step={0.01}
            type="range"
            value={lightElevation}
            onChange={(event) => onLightElevationChange(Number(event.target.value))}
            onInput={(event) => onLightElevationChange(Number(event.currentTarget.value))}
          />
        </label>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Rotation</dt>
          <dd className="text-right text-slate-200">{Math.round(shipRotation)} deg</dd>
          <dt className="text-slate-500">Light</dt>
          <dd className="text-right text-slate-200">{Math.round(lightAngle)} deg</dd>
          <dt className="text-slate-500">Elevation</dt>
          <dd className="text-right text-slate-200">{formatNumber(lightElevation)}</dd>
        </dl>
      </div>
    </CollapsibleSection>
  );
}
