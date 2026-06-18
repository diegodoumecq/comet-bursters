import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import type { PlayerShipHeightmapConfig } from '../../phaser/player/shipHeightmapConfig';
import type {
  PlayerShipHeightmapControl,
  PlayerShipHeightmapControlSection,
} from '../../phaser/player/shipHeightmapControls';
import {
  getConfigNumber,
  getControlInputId,
  getMaterialColor,
  readFiniteInput,
} from '../sectionUtils';

export function HeightmapControlSection({
  config,
  onControlChange,
  section,
}: {
  config: PlayerShipHeightmapConfig;
  onControlChange: (control: PlayerShipHeightmapControl, value: number) => void;
  section: PlayerShipHeightmapControlSection;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title={section.title}
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex justify-end gap-1.5">
          {section.materials.map((material) => (
            <span
              key={material}
              role="img"
              aria-label={`${section.title} material ${material}`}
              title={material}
              className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: getMaterialColor(material) }}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4">
          {section.controls.map((control) => {
            const value = getConfigNumber(config, control.path);
            const inputId = getControlInputId(section.title, control.label);
            return (
              <div key={control.label}>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={inputId}
                    className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                  >
                    {control.label}
                  </label>
                  <input
                    aria-label={`Value for ${control.label}`}
                    className="h-8 w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 text-right text-sm text-white outline-none focus:border-cyan-300"
                    max={control.max}
                    min={control.min}
                    step={control.step}
                    type="number"
                    value={value}
                    onChange={(event) =>
                      onControlChange(
                        control,
                        readFiniteInput(event.target.value, value, control.min, control.max),
                      )
                    }
                  />
                </div>
                <input
                  id={inputId}
                  className="mt-2 w-full accent-cyan-300"
                  max={control.max}
                  min={control.min}
                  step={control.step}
                  type="range"
                  value={value}
                  onChange={(event) => onControlChange(control, Number(event.target.value))}
                  onInput={(event) => onControlChange(control, Number(event.currentTarget.value))}
                />
              </div>
            );
          })}
        </div>
      </div>
    </CollapsibleSection>
  );
}
