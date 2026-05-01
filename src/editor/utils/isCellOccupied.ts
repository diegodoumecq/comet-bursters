import type { EditorDocument } from '../state/history';
import { getCellKey } from './getCellKey';

export function isCellOccupied(document: EditorDocument, layerId: string, x: number, y: number): boolean {
  return (
    document.level.layers
      .find((layer) => layer.id === layerId)
      ?.tiles.some((tile) => tile.x === x && tile.y === y) ||
    Boolean(document.materialPlacements[layerId]?.[getCellKey(x, y)])
  );
}
