import { useState } from 'react';

import { CollapsibleSection } from './ui/components/CollapsibleSection';
import { Switch } from './ui/components/Switch';

type SandboxPerfToggleKey =
  | 'arcadeDimensionDebug'
  | 'sandboxPerfMarkers'
  | 'sandboxBiomeDebug'
  | 'sandboxBlackHoles'
  | 'sandboxFuelMetaballs'
  | 'sandboxMinimap'
  | 'sandboxNebulaRegions'
  | 'sandboxStarfield'
  | 'sandboxThreeBackground';

const SANDBOX_PERF_TOGGLES: Array<{
  defaultValue: boolean;
  key: SandboxPerfToggleKey;
  label: string;
}> = [
  { defaultValue: false, key: 'arcadeDimensionDebug', label: 'Rift ownership rings' },
  { defaultValue: false, key: 'sandboxPerfMarkers', label: 'Perf markers' },
  { defaultValue: false, key: 'sandboxBiomeDebug', label: 'Biome polygons' },
  { defaultValue: true, key: 'sandboxBlackHoles', label: 'Black holes' },
  { defaultValue: true, key: 'sandboxFuelMetaballs', label: 'Fuel metaballs' },
  { defaultValue: true, key: 'sandboxMinimap', label: 'Minimap' },
  { defaultValue: true, key: 'sandboxNebulaRegions', label: 'Nebula regions' },
  { defaultValue: true, key: 'sandboxStarfield', label: 'Starfield' },
  { defaultValue: true, key: 'sandboxThreeBackground', label: 'Three background' },
];

function readSandboxPerfToggles(): Record<SandboxPerfToggleKey, boolean> {
  const toggles = {} as Record<SandboxPerfToggleKey, boolean>;
  for (const toggle of SANDBOX_PERF_TOGGLES) {
    const saved = window.sessionStorage.getItem(`comet-bursters-${toggle.key}`);
    toggles[toggle.key] = saved === null ? toggle.defaultValue : saved !== 'false';
  }
  return toggles;
}

export function LandingApp() {
  const [startingWave, setStartingWave] = useState(() => {
    const saved = window.sessionStorage.getItem('comet-bursters-starting-wave');
    const parsed = saved ? Number.parseInt(saved, 10) : 1;
    return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 1;
  });
  const [fogEnabled, setFogEnabled] = useState(() => {
    const saved = window.sessionStorage.getItem('comet-bursters-fog-enabled');
    return saved !== 'false';
  });
  const [gridEnabled, setGridEnabled] = useState(() => {
    const saved = window.sessionStorage.getItem('comet-bursters-sandboxGrid');
    return saved !== 'false';
  });
  const [arcadeRiftDebugEnabled, setArcadeRiftDebugEnabled] = useState(() => {
    const saved = window.sessionStorage.getItem('comet-bursters-arcadeRiftDebug');
    return saved === 'true';
  });
  const [gameSetupOpen, setGameSetupOpen] = useState(() => {
    const saved = window.sessionStorage.getItem('comet-bursters-game-setup-open');
    return saved !== 'false';
  });
  const [sandboxProfilingOpen, setSandboxProfilingOpen] = useState(() => {
    const saved = window.sessionStorage.getItem('comet-bursters-sandbox-profiling-open');
    return saved === 'true';
  });
  const [sandboxPerfToggles, setSandboxPerfToggles] = useState(readSandboxPerfToggles);

  function updateStartingWave(value: number): void {
    const next = Math.max(1, Math.min(50, Math.round(value || 1)));
    setStartingWave(next);
    window.sessionStorage.setItem('comet-bursters-starting-wave', String(next));
  }

  function updateFogEnabled(checked: boolean): void {
    setFogEnabled(checked);
    window.sessionStorage.setItem('comet-bursters-fog-enabled', String(checked));
  }

  function updateGridEnabled(checked: boolean): void {
    setGridEnabled(checked);
    window.sessionStorage.setItem('comet-bursters-sandboxGrid', String(checked));
  }

  function updateArcadeRiftDebugEnabled(checked: boolean): void {
    setArcadeRiftDebugEnabled(checked);
    window.sessionStorage.setItem('comet-bursters-arcadeRiftDebug', String(checked));
  }

  function updateSandboxPerfToggle(key: SandboxPerfToggleKey, checked: boolean): void {
    setSandboxPerfToggles((current) => ({ ...current, [key]: checked }));
    window.sessionStorage.setItem(`comet-bursters-${key}`, String(checked));
  }

  function toggleGameSetup(): void {
    const next = !gameSetupOpen;
    setGameSetupOpen(next);
    window.sessionStorage.setItem('comet-bursters-game-setup-open', String(next));
  }

  function toggleSandboxProfiling(): void {
    const next = !sandboxProfilingOpen;
    setSandboxProfilingOpen(next);
    window.sessionStorage.setItem('comet-bursters-sandbox-profiling-open', String(next));
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="mx-auto flex h-screen max-w-2xl flex-col px-6 py-10">
        <header className="shrink-0">
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight text-white">
            Comet Bursters Launch
          </h1>
        </header>

        <main className="mt-8 flex flex-1 flex-col items-stretch gap-3 overflow-y-auto pr-1">
          <a
            href="/phaser-game.html"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/60 hover:bg-slate-800 focus-visible:border-cyan-300 focus-visible:outline-none"
          >
            Open Game
          </a>

          <a
            href="/editor.html"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/60 hover:bg-slate-800 focus-visible:border-cyan-300 focus-visible:outline-none"
          >
            Open Editor
          </a>

          <a
            href="/spritesheet-editor.html"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/60 hover:bg-slate-800 focus-visible:border-cyan-300 focus-visible:outline-none"
          >
            Open Spritesheet Editor
          </a>

          <a
            href="/sprite-editor.html"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/60 hover:bg-slate-800 focus-visible:border-cyan-300 focus-visible:outline-none"
          >
            Open Sprite Editor
          </a>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <CollapsibleSection
              title="Game setup"
              isOpen={gameSetupOpen}
              onToggle={toggleGameSetup}
            >
              <div className="flex flex-col items-stretch gap-4 p-6">
                <label className="block text-sm font-medium text-slate-300">
                  Starting wave
                  <input
                    className="mt-2 block w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-300"
                    min={1}
                    max={50}
                    type="number"
                    value={startingWave}
                    onChange={(event) => updateStartingWave(Number(event.target.value))}
                  />
                </label>
                <label className="flex min-h-10 items-center gap-3 text-sm font-medium text-slate-300">
                  <Switch checked={fogEnabled} onCheckedChange={updateFogEnabled} />
                  Fog
                </label>
                <label className="flex min-h-10 items-center gap-3 text-sm font-medium text-slate-300">
                  <Switch checked={gridEnabled} onCheckedChange={updateGridEnabled} />
                  Grid
                </label>
                <label className="flex min-h-10 items-center gap-3 text-sm font-medium text-slate-300">
                  <Switch
                    checked={arcadeRiftDebugEnabled}
                    onCheckedChange={updateArcadeRiftDebugEnabled}
                  />
                  Arcade rift T spawn
                </label>
              </div>
            </CollapsibleSection>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <CollapsibleSection
              title="Debug/profiling"
              isOpen={sandboxProfilingOpen}
              onToggle={toggleSandboxProfiling}
            >
              <div className="flex flex-col items-stretch gap-3 p-6">
                {SANDBOX_PERF_TOGGLES.map((toggle) => (
                  <label
                    className="flex min-h-10 items-center gap-3 text-sm font-medium text-slate-300"
                    key={toggle.key}
                  >
                    <Switch
                      checked={sandboxPerfToggles[toggle.key]}
                      onCheckedChange={(checked) => updateSandboxPerfToggle(toggle.key, checked)}
                    />
                    {toggle.label}
                  </label>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        </main>
      </div>
    </div>
  );
}
