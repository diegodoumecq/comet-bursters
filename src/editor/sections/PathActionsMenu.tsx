import { DropdownMenu } from '@/ui/components/DropdownMenu';

export function PathActionsMenu({
  isOpen,
  onClose,
  onDelete,
  onRename,
  onToggle,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onRename: () => void;
  onToggle: () => void;
}) {
  return (
    <DropdownMenu
      isOpen={isOpen}
      onClose={onClose}
      onToggle={onToggle}
      menuClassName="z-10 min-w-28 rounded-lg"
      trigger={
        <span className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200 hover:border-slate-500">
          ...
        </span>
      }
    >
      <button
        type="button"
        onClick={onRename}
        className="block w-full rounded-md px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
      >
        Rename
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
