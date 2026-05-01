import { useSpriteEditorStore } from '../state/spriteEditorStore';

export function SpriteEditorBrushPreview({
  preview,
}: {
  preview: { left: number; size: number; top: number } | null;
}) {
  const brushColor = useSpriteEditorStore((state) => state.brushColor);
  const tool = useSpriteEditorStore((state) => state.tool);

  if (!preview) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute border"
      style={{
        backgroundColor:
          tool === 'erase'
            ? 'rgba(248, 113, 113, 0.18)'
            : `rgba(${brushColor.r}, ${brushColor.g}, ${brushColor.b}, ${Math.max(
                0.12,
                (brushColor.a / 255) * 0.35,
              )})`,
        borderColor:
          tool === 'erase'
            ? 'rgba(248, 113, 113, 0.9)'
            : 'rgba(255, 255, 255, 0.9)',
        boxSizing: 'border-box',
        height: `${preview.size}px`,
        left: `${preview.left}px`,
        top: `${preview.top}px`,
        width: `${preview.size}px`,
      }}
    />
  );
}
