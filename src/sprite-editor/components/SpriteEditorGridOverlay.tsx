import { useSpriteEditorStore } from '../state/spriteEditorStore';

export function SpriteEditorGridOverlay({
  canvasHeight,
  canvasWidth,
  hasActiveAsset,
  viewportOffset,
}: {
  canvasHeight: number;
  canvasWidth: number;
  hasActiveAsset: boolean;
  viewportOffset: { x: number; y: number };
}) {
  const gridColor = useSpriteEditorStore((state) => state.gridColor);
  const gridOpacity = useSpriteEditorStore((state) => state.gridOpacity);
  const gridSettings = useSpriteEditorStore((state) => state.gridSettings);
  const isGridVisible = useSpriteEditorStore((state) => state.isGridVisible);
  const zoom = useSpriteEditorStore((state) => state.zoom);

  const gridStepX = gridSettings.frameWidth + (gridSettings.gapX ?? 0);
  const gridStepY = gridSettings.frameHeight + (gridSettings.gapY ?? 0);
  const scaledCanvasWidth = Math.round(canvasWidth * zoom);
  const scaledCanvasHeight = Math.round(canvasHeight * zoom);
  const scaledGridStepX = Math.round(gridStepX * zoom);
  const scaledGridStepY = Math.round(gridStepY * zoom);
  const scaledGridOffsetX = Math.round((gridSettings.offsetX ?? 0) * zoom);
  const scaledGridOffsetY = Math.round((gridSettings.offsetY ?? 0) * zoom);

  const verticalLines =
    isGridVisible && hasActiveAsset && gridSettings.frameWidth > 0 && scaledGridStepX > 0
      ? Array.from(
          {
            length:
              Math.floor(Math.max(scaledCanvasWidth - scaledGridOffsetX, 0) / scaledGridStepX) + 1,
          },
          (_, index) => scaledGridOffsetX + index * scaledGridStepX,
        ).filter((position) => position >= 0 && position <= scaledCanvasWidth)
      : [];
  const horizontalLines =
    isGridVisible && hasActiveAsset && gridSettings.frameHeight > 0 && scaledGridStepY > 0
      ? Array.from(
          {
            length:
              Math.floor(Math.max(scaledCanvasHeight - scaledGridOffsetY, 0) / scaledGridStepY) + 1,
          },
          (_, index) => scaledGridOffsetY + index * scaledGridStepY,
        ).filter((position) => position >= 0 && position <= scaledCanvasHeight)
      : [];

  if (verticalLines.length === 0 && horizontalLines.length === 0) {
    return null;
  }

  const gridColorWithAlpha = `${gridColor}${Math.round(gridOpacity * 255)
    .toString(16)
    .padStart(2, '0')}`;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        height: `${scaledCanvasHeight}px`,
        left: `${viewportOffset.x}px`,
        top: `${viewportOffset.y}px`,
        width: `${scaledCanvasWidth}px`,
      }}
    >
      {verticalLines.map((position) => (
        <div
          key={`grid-v-${position}`}
          className="absolute top-0"
          style={{
            backgroundColor: gridColorWithAlpha,
            height: `${scaledCanvasHeight}px`,
            left: `${position}px`,
            width: '1px',
          }}
        />
      ))}
      {horizontalLines.map((position) => (
        <div
          key={`grid-h-${position}`}
          className="absolute left-0"
          style={{
            backgroundColor: gridColorWithAlpha,
            height: '1px',
            top: `${position}px`,
            width: `${scaledCanvasWidth}px`,
          }}
        />
      ))}
    </div>
  );
}
