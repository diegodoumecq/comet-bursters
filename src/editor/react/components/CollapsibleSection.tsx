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
        className="flex w-full items-center justify-between text-left"
      >
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`}
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
