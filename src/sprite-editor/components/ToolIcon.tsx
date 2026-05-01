import type { SpriteEditorTool } from '../state/spriteEditorStore';

export function ToolIcon({ tool }: { tool: SpriteEditorTool }) {
  const className = 'h-4 w-4';

  if (tool === 'draw') {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M4 14.5 13.8 4.7a1.8 1.8 0 0 1 2.5 0l-10 10L3.5 16.5z" />
        <path d="M12.5 6l1.5 1.5" />
      </svg>
    );
  }

  if (tool === 'move') {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="m10 2 2.5 2.5L10 7 7.5 4.5 10 2Z" />
        <path d="m18 10-2.5 2.5L13 10l2.5-2.5L18 10Z" />
        <path d="m10 18-2.5-2.5L10 13l2.5 2.5L10 18Z" />
        <path d="M2 10 4.5 7.5 7 10l-2.5 2.5L2 10Z" />
        <path d="M10 6v8M6 10h8" />
      </svg>
    );
  }

  if (tool === 'select') {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M4 7V4h3M13 4h3v3M16 13v3h-3M7 16H4v-3" />
        <path d="M4 10V8M10 4H8M16 10V8M10 16H8M4 12v-2M12 4h-2M16 12v-2M12 16h-2" />
      </svg>
    );
  }

  if (tool === 'erase') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" />
        <path d="M18 13.3l-6.3 -6.3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M11 7l6 6" />
      <path d="M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4" />
    </svg>
  );
}
