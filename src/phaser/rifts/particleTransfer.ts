import type { ParticleEntity } from '../particles/types';
import { getPortalTransferDecision } from './portalTransfer';
import type { RiftSourceSpace } from './types';

export function releaseExitedRiftParticles(sourceSpace: RiftSourceSpace): ParticleEntity[] {
  const released: ParticleEntity[] = [];
  for (let index = sourceSpace.particles.length - 1; index >= 0; index -= 1) {
    const particle = sourceSpace.particles[index];
    const decision = getPortalTransferDecision(
      {
        membership: particle.membership ?? { portalId: sourceSpace.portal.id, space: 'rift' },
        position: particle.position,
        radius: getParticleRadius(particle),
        velocity: particle.velocity,
      },
      sourceSpace.portal,
    );
    if (decision?.space === 'arcade') {
      particle.membership = decision.membership;
      particle.position = decision.position;
      particle.velocity = decision.velocity;
      sourceSpace.particles.splice(index, 1);
      released.push(particle);
    }
  }
  return released;
}

function getParticleRadius(particle: ParticleEntity): number {
  return particle.radius ?? particle.size ?? 1;
}
