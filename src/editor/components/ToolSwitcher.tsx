import { useEditorStore } from '../state/editorStore';

export function ToolSwitcher() {
  const onChange = useEditorStore((state) => state.setTool);
  const tool = useEditorStore((state) => state.tool);

  return (
    <div className="grid grid-cols-5 gap-2">
      {(['select', 'tiles', 'materials', 'entities', 'paths'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-xl border px-3 py-2 text-sm capitalize ${
            tool === option
              ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
              : 'border-slate-700 bg-slate-950/80 text-slate-300 hover:border-slate-500'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
