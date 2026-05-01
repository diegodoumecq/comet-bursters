import { DropdownMenu } from '@/ui/components/DropdownMenu';

export function SpritesheetHeaderMenu({
  isOpen,
  onClose,
  onCreateNew,
  onReset,
  onSave,
  onToggle,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateNew: () => void;
  onReset: () => void;
  onSave: () => void;
  onToggle: () => void;
}) {
  return (
    <DropdownMenu
      align="left"
      isOpen={isOpen}
      onClose={onClose}
      onToggle={onToggle}
      menuClassName="rounded-xl"
      trigger={
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:border-slate-500 hover:text-white"
          aria-label="More options"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 5h14" />
            <path d="M3 10h14" />
            <path d="M3 15h14" />
          </svg>
        </span>
      }
    >
      <button
        type="button"
        onClick={onSave}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCreateNew}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
      >
        New
      </button>
      <button
        type="button"
        onClick={onReset}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-500/15"
      >
        Reset
      </button>
    </DropdownMenu>
  );
}
