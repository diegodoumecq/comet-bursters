import { DropdownMenu } from '@/ui/components/DropdownMenu';

export function LayerActionsMenu({
  isOpen,
  isCollidable,
  isOverhead,
  layerId,
  onClose,
  onDelete,
  onOpacityChange,
  onRename,
  onToggle,
  onToggleCollision,
  onToggleOverhead,
  opacity,
}: {
  isOpen: boolean;
  isCollidable: boolean;
  isOverhead: boolean;
  layerId: string;
  onClose: () => void;
  onDelete: () => void;
  onOpacityChange: (opacity: number) => void;
  onRename: () => void;
  onToggle: () => void;
  onToggleCollision: () => void;
  onToggleOverhead: () => void;
  opacity: number;
}) {
  return (
    <DropdownMenu
      isOpen={isOpen}
      onClose={onClose}
      onToggle={onToggle}
      menuClassName="min-w-52 rounded-lg"
      trigger={
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/70 text-slate-200 transition hover:border-slate-500">
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
      <div className="border-b border-slate-800 px-3 py-2">
        <label className="block text-xs font-medium text-slate-300">
          Opacity {Math.round(opacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(opacity * 100)}
          onChange={(event) => onOpacityChange(Number(event.target.value) / 100)}
          className="mt-2 w-full"
          aria-label={`${layerId} opacity`}
        />
      </div>
      <button
        type="button"
        onClick={onRename}
        className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
      >
        Rename
      </button>
      <button
        type="button"
        onClick={onToggleCollision}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
      >
        {isCollidable ? 'Disable collision' : 'Enable collision'}
      </button>
      <button
        type="button"
        onClick={onToggleOverhead}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
      >
        {isOverhead ? 'Render under entities' : 'Render overhead'}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="block w-full rounded-md px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-500/15"
      >
        Delete
      </button>
    </DropdownMenu>
  );
}
