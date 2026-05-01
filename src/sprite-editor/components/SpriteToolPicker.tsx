import type { SpriteEditorTool } from '../state/spriteEditorStore';
import { ToolIcon } from './ToolIcon';

export function SpriteToolPicker({
  activeTool,
  onSelectTool,
}: {
  activeTool: SpriteEditorTool;
  onSelectTool: (tool: SpriteEditorTool) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          ['draw', 'Brush', 'B'],
          ['move', 'Move', 'V'],
          ['select', 'Select', 'M'],
          ['erase', 'Erase', 'E'],
          ['picker', 'Pick', 'I'],
        ] as const
      ).map(([nextTool, label, shortcut]) => (
        <button
          key={nextTool}
          type="button"
          onClick={() => onSelectTool(nextTool)}
          aria-label={`${label} (${shortcut})`}
          title={`${label} (${shortcut})`}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
            activeTool === nextTool
              ? 'border-cyan-300 bg-cyan-500/15 text-cyan-100'
              : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
          }`}
        >
          <ToolIcon tool={nextTool} />
        </button>
      ))}
    </div>
  );
}
