export function CollapsibleSection({
  children,
  isOpen,
  onToggle,
  title,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-slate-700 hover:bg-slate-900/70 focus-visible:border-cyan-400/60 focus-visible:bg-slate-900/80 focus-visible:outline-none active:scale-[0.99] active:bg-slate-900"
      >
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-slate-500 transition duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 7 5 5 5-5" />
        </svg>
      </button>
      {isOpen ? children : null}
    </section>
  );
}
