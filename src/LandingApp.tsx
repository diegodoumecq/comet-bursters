import { useMemo, useState } from 'react';

export function LandingApp() {
  const [startingWave, setStartingWave] = useState(() => {
    const saved = window.sessionStorage.getItem('comet-bursters-starting-wave');
    const parsed = saved ? Number.parseInt(saved, 10) : 1;
    return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 1;
  });
  const gameHref = useMemo(() => `/game.html?startingWave=${startingWave}`, [startingWave]);
  const phaserGameHref = useMemo(() => `/phaser-game.html?startingWave=${startingWave}`, [startingWave]);

  function updateStartingWave(value: number): void {
    const next = Math.max(1, Math.min(50, Math.round(value || 1)));
    setStartingWave(next);
    window.sessionStorage.setItem('comet-bursters-starting-wave', String(next));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="mb-10">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Comet Bursters
          </div>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight text-white">
            Choose A Runtime Or Tool
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-400">
            The legacy game, the Phaser rewrite, and the editors live as separate entrypoints.
          </p>
          <label className="mt-8 block text-sm font-medium text-slate-300">
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
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-2 2xl:grid-cols-5">
          <div
            className="group rounded-3xl border border-slate-800 bg-slate-900/70 p-8 transition hover:border-cyan-400/50 hover:bg-slate-900"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Runtime
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">Open Game</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Launch the original canvas-based game client with scenes, controls, and current
              gameplay flow.
            </p>
            <a className="mt-8 inline-block text-sm font-medium text-cyan-200" href={gameHref}>
              Go to game
            </a>
          </div>

          <a
            href={phaserGameHref}
            className="group rounded-3xl border border-slate-800 bg-slate-900/70 p-8 transition hover:border-cyan-400/50 hover:bg-slate-900"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Rewrite
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">Open Phaser Game</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Launch the new Phaser-based runtime while the rewrite is developed in parallel.
            </p>
            <div className="mt-10 text-sm font-medium text-cyan-200">Go to Phaser game</div>
          </a>

          <a
            href="/editor.html"
            className="group rounded-3xl border border-slate-800 bg-slate-900/70 p-8 transition hover:border-cyan-400/50 hover:bg-slate-900"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Authoring
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">Open Editor</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Launch the React + Tailwind level editor to choose tileset assets, paint layers, and
              manage level JSON.
            </p>
            <div className="mt-10 text-sm font-medium text-cyan-200">Go to editor</div>
          </a>

          <a
            href="/spritesheet-editor.html"
            className="group rounded-3xl border border-slate-800 bg-slate-900/70 p-8 transition hover:border-cyan-400/50 hover:bg-slate-900"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Assets
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">Open Spritesheet Editor</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Edit tileset JSON definitions for each spritesheet PNG, including grid bounds and
              named tile coordinates.
            </p>
            <div className="mt-10 text-sm font-medium text-cyan-200">Go to spritesheets</div>
          </a>

          <a
            href="/sprite-editor.html"
            className="group rounded-3xl border border-slate-800 bg-slate-900/70 p-8 transition hover:border-cyan-400/50 hover:bg-slate-900"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Paint
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">Open Sprite Editor</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Browse PNG assets, paint directly on them pixel by pixel, and save the edited image
              back into `src/assets`.
            </p>
            <div className="mt-10 text-sm font-medium text-cyan-200">Go to sprite editor</div>
          </a>
        </main>
      </div>
    </div>
  );
}
