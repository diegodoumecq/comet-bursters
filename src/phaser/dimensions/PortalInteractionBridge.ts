import { portalApertureContainsCenter } from './portalGeometry';
import type { PortalEntity, TransferableEntitySnapshot } from './types';

export type PortalBridgePair = {
  arcade: TransferableEntitySnapshot;
  rift: TransferableEntitySnapshot;
};

export function getPortalBridgePairs(input: {
  arcade: TransferableEntitySnapshot[];
  portal: PortalEntity | null;
  rift: TransferableEntitySnapshot[];
}): PortalBridgePair[] {
  const { portal } = input;
  if (!portal || portal.lifecycle !== 'active') return [];

  const arcadeInside = input.arcade.filter((entity) =>
    portalApertureContainsCenter(portal, entity.position),
  );
  const riftInside = input.rift.filter((entity) =>
    portalApertureContainsCenter(portal, entity.position),
  );
  const pairs: PortalBridgePair[] = [];
  for (const arcade of arcadeInside) {
    for (const rift of riftInside) {
      pairs.push({ arcade, rift });
    }
  }
  return pairs;
}
