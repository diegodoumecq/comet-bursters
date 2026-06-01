import type { MatterImage } from '../core/types';
import { PLAYER_COLLISION_RADIUS, PLAYER_COLLISION_REAR_OFFSET } from './config';

export function setPlayerCollisionCircle(target: MatterImage, scale: number): void {
  const radius = PLAYER_COLLISION_RADIUS * scale;
  const offset = PLAYER_COLLISION_REAR_OFFSET * scale;
  target.setCircle(radius);
  target.scene.matter.body.setCentre(target.body, { x: -offset, y: 0 }, true);
}
