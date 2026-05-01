import { useState } from 'react';

import { CollapsibleSection } from '@/ui/components/CollapsibleSection';
import type { SpriteAssetEntry } from '../assetCatalog';

export function AssetsSection({
  activeAssetPath,
  assetsByCategory,
  onSelectAsset,
  totalAssetCount,
}: {
  activeAssetPath: string | null;
  assetsByCategory: Record<string, SpriteAssetEntry[]>;
  onSelectAsset: (assetPath: string) => void;
  totalAssetCount: number;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <CollapsibleSection
      title={`Assets (${totalAssetCount})`}
      isOpen={isOpen}
      onToggle={() => setIsOpen((current) => !current)}
    >
      <div className="space-y-5">
        {Object.entries(assetsByCategory).map(([category, assets]) => (
          <section key={category}>
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {category}
            </div>
            <div className="space-y-2">
              {assets.map((asset) => (
                <button
                  key={asset.assetPath}
                  type="button"
                  onClick={() => onSelectAsset(asset.assetPath)}
                  className={`grid w-full grid-cols-[3rem_1fr] gap-3 rounded-2xl border p-3 text-left transition ${
                    asset.assetPath === activeAssetPath
                      ? 'border-cyan-300 bg-cyan-500/15'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                    <img
                      src={asset.url}
                      alt={asset.fileName}
                      className="max-h-full max-w-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-100">
                      {asset.fileName}
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">{asset.assetPath}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </CollapsibleSection>
  );
}
