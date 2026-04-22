import { useState } from 'react';

import { getTilesetForLayer } from '../shared/levelEditing';
import { getMaterialColor, getTilesetMaterials } from '../shared/materials';
import { useEditorStore } from '../state/editorStore';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';

export function MaterialsSection() {
  const level = useEditorStore((state) => state.level);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const selectedMaterialId = useEditorStore((state) => state.selectedMaterialId);
  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const setSelectedMaterialId = useEditorStore((state) => state.setSelectedMaterialId);
  const selectedTileset = getTilesetForLayer(level, selectedLayerId);
  const materialNames = getTilesetMaterials(selectedTileset);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(true);

  return (
    <CollapsibleSection
      title="Materials"
      isOpen={isMaterialsOpen}
      onToggle={() => setIsMaterialsOpen((current) => !current)}
    >
      <div className="space-y-3">
        <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Layer
          <select
            value={selectedLayerId ?? ''}
            onChange={(event) => setSelectedLayerId(event.currentTarget.value || null)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
          >
            {level.layers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.id}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs leading-5 text-slate-500">
          Paints the selected material using the first tile that matches adjacent neighbors.
        </div>
        {materialNames.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {materialNames.map((materialName) => (
              <button
                key={materialName}
                type="button"
                onClick={() => setSelectedMaterialId(materialName)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedMaterialId === materialName
                    ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
                    : 'border-slate-700 bg-slate-950/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded border border-white/20"
                  style={{ backgroundColor: getMaterialColor(materialName) }}
                />
                <span className="min-w-0 truncate">{materialName}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-3 text-sm text-slate-500">
            No materials found for the active tileset.
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
