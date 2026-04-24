export function Switch({
  checked,
  className = '',
  disabled = false,
  onCheckedChange,
}: {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-cyan-400/70 bg-cyan-500/30'
          : 'border-slate-700 bg-slate-900/80'
      } ${className}`.trim()}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
