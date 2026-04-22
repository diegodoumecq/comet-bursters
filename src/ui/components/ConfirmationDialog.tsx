export function ConfirmationDialog({
  confirmLabel = 'Confirm',
  isOpen,
  message,
  onCancel,
  onConfirm,
  title,
}: {
  confirmLabel?: string;
  isOpen: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="text-lg font-semibold text-slate-100">{title}</div>
        <div className="mt-3 text-sm text-slate-400">{message}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-300 hover:bg-rose-500/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
