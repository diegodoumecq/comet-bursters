export function circlesOverlap(distance: number, radiusA: number, radiusB: number): boolean {
  return distance <= radiusA + radiusB;
}

export function circleContains(distance: number, radius: number): boolean {
  return distance <= radius;
}
