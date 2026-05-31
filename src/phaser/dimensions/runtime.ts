import { DimensionCoordinator } from './DimensionCoordinator';

let coordinator: DimensionCoordinator | null = null;

export function getDimensionCoordinator(): DimensionCoordinator {
  coordinator ??= new DimensionCoordinator();
  return coordinator;
}

export function resetDimensionCoordinator(): DimensionCoordinator {
  coordinator = new DimensionCoordinator();
  return coordinator;
}
