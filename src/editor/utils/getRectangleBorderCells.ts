export function getRectangleBorderCells(startX: number, startY: number, endX: number, endY: number) {
  const left = Math.min(startX, endX);
  const right = Math.max(startX, endX);
  const top = Math.min(startY, endY);
  const bottom = Math.max(startY, endY);
  const cells: { x: number; y: number }[] = [];

  for (let x = left; x <= right; x += 1) {
    cells.push({ x, y: top });
    if (bottom !== top) {
      cells.push({ x, y: bottom });
    }
  }

  for (let y = top + 1; y < bottom; y += 1) {
    cells.push({ x: left, y });
    if (right !== left) {
      cells.push({ x: right, y });
    }
  }

  return cells;
}
