export function StatusBanner({
  loadError,
  message,
}: {
  loadError: string | null;
  message: string | null;
}) {
  if (!message && !loadError) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm">
      {message ? <div className="text-emerald-300">{message}</div> : null}
      {loadError ? <div className="text-rose-300">{loadError}</div> : null}
    </div>
  );
}
