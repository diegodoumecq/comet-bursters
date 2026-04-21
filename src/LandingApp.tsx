export function LandingApp() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="mb-10">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Comet Bursters
          </div>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight text-white">
            Choose Between The Game And The Level Editor
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-400">
            The runtime game and the editor now live as separate entrypoints. Use the game for
            playtesting and the editor for asset selection, tiles, and level authoring.
          </p>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-3">
          <a
            href="/game.html"
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
            <div className="mt-10 text-sm font-medium text-cyan-200">Go to game</div>
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
        </main>
      </div>
    </div>
  );
}
