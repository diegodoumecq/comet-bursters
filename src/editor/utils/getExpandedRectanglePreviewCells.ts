import { getCellKey } from './getCellKey';

export function getExpandedRectanglePreviewCells(cells: Array<{ x: number; y: number }>) {
  const uniqueCells = new Map<string, { x: number; y: number }>();

  for (const cell of cells) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const expandedCell = { x: cell.x + dx, y: cell.y + dy };
        uniqueCells.set(getCellKey(expandedCell.x, expandedCell.y), expandedCell);
      }
    }
  }

  return Array.from(uniqueCells.values());
}
