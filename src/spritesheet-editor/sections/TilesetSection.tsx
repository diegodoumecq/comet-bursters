import { useState } from 'react';

import { shipInteriorTileAssets } from '../../scenes/ShipInteriorScene/tileAssets';
import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import { editorBundledTilesets, useSpritesheetEditorStore } from '../state/spritesheetEditorStore';

export function TilesetSection() {
  const { selectTileset, updateTilesetId, updateTilesetImageSrc } = useSpritesheetEditorStore(
    (state) => state.handlers,
  );
  const selectedFileName = useSpritesheetEditorStore((state) => state.selectedFileName);
  const tileset = useSpritesheetEditorStore((state) => state.tileset);
  const [isOpen, setIsOpen] = useState(true);

  if (!tileset) {
    return null;
  }

  return (
    <CollapsibleSection
      title="Tileset"
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Tileset JSON
          <select
            value={selectedFileName}
            onChange={(event) => selectTileset(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
          >
            {selectedFileName ? null : <option value="">Unsaved new tileset</option>}
            {selectedFileName &&
            !editorBundledTilesets.some((entry) => entry.fileName === selectedFileName) ? (
              <option value={selectedFileName}>{selectedFileName}</option>
            ) : null}
            {editorBundledTilesets.map((entry) => (
              <option key={entry.fileName} value={entry.fileName}>
                {entry.fileName}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Id
          <input
            value={tileset.id}
            onChange={(event) => updateTilesetId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
          />
        </label>

        <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          PNG Asset
          <select
            value={tileset.imageSrc}
            onChange={(event) => updateTilesetImageSrc(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-400"
          >
            {shipInteriorTileAssets.map((asset) => (
              <option key={asset.imageSrc} value={asset.imageSrc}>
                {asset.fileName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </CollapsibleSection>
  );
}
