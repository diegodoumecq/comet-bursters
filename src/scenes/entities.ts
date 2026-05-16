export interface SceneEntityRenderContext {
  now: number;
  [key: string]: unknown;
}

export interface SceneEntity {
  id?: string;
  entityType?: string;
  zIndex: number;
  active?: boolean;
  update?: () => void;
  render: (ctx: CanvasRenderingContext2D, context: SceneEntityRenderContext) => void;
}

type EntityRenderer = SceneEntity['render'];

export function configureEntity<T extends object>(
  entity: T,
  type: string,
  zIndex: number,
  render: EntityRenderer,
): T & SceneEntity {
  return Object.assign(entity, {
    id: getObjectEntityId(type, entity),
    entityType: type,
    zIndex,
    render,
  });
}

export function configurePlanetEntity<T extends object>(entity: T, render: EntityRenderer): T & SceneEntity {
  return configureEntity(entity, 'planet', 10, render);
}

export function configureProjectileEntity<T extends object>(
  type: 'bullet' | 'inspectionProbe',
  entity: T,
  render: EntityRenderer,
): T & SceneEntity {
  return configureEntity(entity, type, 20, render);
}

export function configureAsteroidEntity<T extends object>(entity: T, render: EntityRenderer): T & SceneEntity {
  return configureEntity(entity, 'asteroid', 20, render);
}

export function configureThrusterParticleEntity<T extends object>(entity: T, render: EntityRenderer): T & SceneEntity {
  return configureEntity(entity, 'thrusterParticle', 30, render);
}

export function configurePlayerEntity<T extends object>(entity: T, render: EntityRenderer, zIndex = 40): T & SceneEntity {
  return Object.assign(entity, { id: 'player', type: 'player', zIndex, render });
}

export function configureParticleEntity<T extends object>(entity: T, render: EntityRenderer): T & SceneEntity {
  return configureEntity(entity, 'particle', 50, render);
}

type RegisteredSceneEntity = SceneEntity & {
  id: string;
  entityType: string;
  order: number;
};

export class SceneEntityRegistry {
  private entities: RegisteredSceneEntity[] = [];
  private nextOrder = 0;

  clear(): void {
    this.entities = [];
    this.nextOrder = 0;
  }

  add(entity: Partial<SceneEntity>): void {
    if (entity.zIndex === undefined || !entity.render) {
      throw new Error('Cannot register an entity before it has zIndex and render');
    }
    const id = entity.id ?? `entity:${this.nextOrder}`;
    const existing = this.entities.find((registeredEntity) => registeredEntity.id === id);
    if (existing) {
      Object.assign(existing, entity, {
        id,
        entityType: entity.entityType ?? existing.entityType,
      });
      return;
    }

    this.entities.push({
      ...entity,
      id,
      entityType: entity.entityType ?? 'entity',
      zIndex: entity.zIndex,
      render: entity.render,
      order: this.nextOrder,
    });
    this.nextOrder += 1;
  }

  remove(id: string): void {
    this.entities = this.entities.filter((entity) => entity.id !== id);
  }

  getByType(type: string): SceneEntity[] {
    return this.entities.filter((entity) => entity.entityType === type);
  }

  updateAll(): void {
    for (const entity of this.entities) {
      if (entity.active !== false) {
        entity.update?.();
      }
    }
  }

  renderAll(ctx: CanvasRenderingContext2D, context: SceneEntityRenderContext): void {
    const sortedEntities = [...this.entities]
      .filter((entity) => entity.active !== false)
      .sort((left, right) => left.zIndex - right.zIndex || left.order - right.order);

    for (const entity of sortedEntities) {
      entity.render(ctx, context);
    }
  }
}

const objectEntityIds = new WeakMap<object, string>();
let nextObjectEntityId = 0;

export function getObjectEntityId(prefix: string, object: object): string {
  const existing = objectEntityIds.get(object);
  if (existing) {
    return existing;
  }

  const id = `${prefix}:${nextObjectEntityId}`;
  nextObjectEntityId += 1;
  objectEntityIds.set(object, id);
  return id;
}
