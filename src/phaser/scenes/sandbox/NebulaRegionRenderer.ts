import Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';
import { nebulaNoiseShader } from '../../world/nebulaShader';
import type { NebulaRegion } from './nebulaRegions';

const MAX_REGION_POINTS = 12;
const NEBULA_REGION_DEPTH = 20;
const SHADER_KEY = 'sandbox-nebula-region-shader-v7';
const COPY_OFFSETS = [-1, 0, 1] as const;
const VISIBLE_ALPHA_THRESHOLD = 0.003;

type RegionBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type RegionCopy = {
  bounds: RegionBounds;
  pointData: Float32Array;
  pointCount: number;
  region: NebulaRegion;
};

function createEdgeShader(pointIndex: number): string {
  const nextIndex = pointIndex === MAX_REGION_POINTS - 1 ? 0 : pointIndex + 1;
  return `
  if (u_point_count > ${pointIndex}) {
    vec2 currentPoint = u_region_points[${pointIndex}];
    vec2 nextPoint = u_point_count > ${pointIndex + 1}
      ? u_region_points[${nextIndex}]
      : u_region_points[0];

    bool crossesY = (currentPoint.y > worldPosition.y) != (nextPoint.y > worldPosition.y);
    float denominator = nextPoint.y - currentPoint.y;
    if (abs(denominator) < 0.0001) {
      denominator = 0.0001;
    }
    float slopeX = (nextPoint.x - currentPoint.x) * (worldPosition.y - currentPoint.y) /
      denominator + currentPoint.x;
    if (crossesY && worldPosition.x < slopeX) {
      inside = !inside;
    }
  }`;
}

function createSignedEdgeDistanceShader(pointIndex: number): string {
  const nextIndex = pointIndex === MAX_REGION_POINTS - 1 ? 0 : pointIndex + 1;
  return `
  if (u_point_count > ${pointIndex}) {
    vec2 currentPoint = u_region_points[${pointIndex}];
    vec2 nextPoint = u_point_count > ${pointIndex + 1}
      ? u_region_points[${nextIndex}]
      : u_region_points[0];
    vec2 edge = nextPoint - currentPoint;
    float edgeLength = max(length(edge), 0.0001);
    float inwardDistance = (edge.x * (worldPosition.y - currentPoint.y) -
      edge.y * (worldPosition.x - currentPoint.x)) / edgeLength;
    nearestDistance = min(nearestDistance, inwardDistance);
  }`;
}

const fragmentShader = `
precision mediump float;

uniform float u_alpha;
uniform float u_feather;
uniform vec2 u_region_origin;
uniform vec2 u_region_points[${MAX_REGION_POINTS}];
uniform int u_point_count;
uniform vec2 resolution;
uniform float u_seed;
uniform vec2 u_world;

varying vec2 fragCoord;

${nebulaNoiseShader}

const float VISIBLE_ALPHA_THRESHOLD = ${VISIBLE_ALPHA_THRESHOLD.toFixed(3)};

vec4 sampleRegionNebula(vec2 world01, float alphaScale) {
  vec2 p = world01 * 8.0;
  float broad = noisePeriodic(p + vec2(u_seed * 0.013, u_seed * 0.021), vec2(8.0));
  float detail = noisePeriodic(p * 3.0 + vec2(5.7, 2.1), vec2(24.0));
  float colorNoise = noisePeriodic(p * 1.5 + vec2(9.2, 4.4), vec2(12.0));
  float nebula = smoothstep(0.36, 0.82, broad * 0.82 + detail * 0.3);
  float core = smoothstep(0.66, 0.94, broad * 0.76 + detail * 0.28);
  float haze = smoothstep(0.18, 0.72, broad * 0.62 + detail * 0.26 + 0.18);
  float density = max(nebula, haze * 0.42);

  vec3 blue = vec3(0.05, 0.13, 0.32);
  vec3 violet = vec3(0.13, 0.08, 0.24);
  vec3 cyan = vec3(0.08, 0.25, 0.34);
  vec3 color = mix(blue, violet, smoothstep(0.25, 0.82, colorNoise));
  color = mix(color, cyan, smoothstep(0.54, 0.94, detail) * 0.34);
  color = color * (density * 0.92 + 0.075) + vec3(0.2, 0.36, 0.68) * core * 0.18;
  return vec4(color, clamp((density * 0.72 + core * 0.32 + 0.16) * alphaScale, 0.0, 1.0));
}

float polygonMask(vec2 worldPosition) {
  bool inside = false;
${Array.from({ length: MAX_REGION_POINTS }, (_, pointIndex) => createEdgeShader(pointIndex)).join('\n')}

  return (inside ? 1.0 : 0.0) * u_alpha;
}

float polygonSignedEdgeDistance(vec2 worldPosition) {
  float nearestDistance = 1000000.0;
${Array.from({ length: MAX_REGION_POINTS }, (_, pointIndex) => createSignedEdgeDistanceShader(pointIndex)).join('\n')}

  return nearestDistance;
}

void main() {
  vec2 localPixel = vec2(fragCoord.x, resolution.y - fragCoord.y);
  vec2 worldPosition = u_region_origin + localPixel;
  vec2 world01 = fract(worldPosition / max(u_world, vec2(1.0)));
  float signedEdgeDistance = polygonSignedEdgeDistance(worldPosition);
  float mask = polygonMask(worldPosition);

  if (mask <= VISIBLE_ALPHA_THRESHOLD || signedEdgeDistance <= 0.0) {
    discard;
  }

  vec4 nebula = sampleRegionNebula(world01, 0.78);
  if (nebula.a <= VISIBLE_ALPHA_THRESHOLD) {
    discard;
  }

  float edgeFade = smoothstep(0.0, max(u_feather, 1.0), signedEdgeDistance);
  float effectiveAlpha = nebula.a * mask * edgeFade;
  vec3 color = mix(nebula.rgb, vec3(0.18, 0.48, 0.62), 0.34);
  gl_FragColor = vec4(color * effectiveAlpha, effectiveAlpha);
}
`;

type NebulaRegionRenderInput = {
  camera: Phaser.Cameras.Scene2D.Camera;
  regions: NebulaRegion[];
  screen: WorldSize;
  world: WorldSize;
};

export class NebulaRegionRenderer {
  private readonly pointDataCache = new Map<string, Float32Array>();
  private readonly regionBoundsCache = new Map<string, RegionBounds>();
  private readonly seed = Math.random() * 1000 + 4000;
  private readonly shaders: Phaser.GameObjects.Shader[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.scene.events.once('shutdown', this.destroy, this);
  }

  render(input: NebulaRegionRenderInput): void {
    this.ensureShaderCached();
    const camera = input.camera;
    camera.preRender();
    const viewport = {
      height: camera.worldView.height,
      width: camera.worldView.width,
      x: camera.worldView.x,
      y: camera.worldView.y,
    };
    const copies = getVisibleRegionCopies(input.regions, input.world, viewport, {
      getPointData: (region, offset) => this.getPointData(region, offset),
      getRegionBounds: (region) => this.getRegionBounds(region),
    });
    this.ensureShaderPool(copies.length);
    this.renderCopies(copies, input.world);
    for (let index = copies.length; index < this.shaders.length; index += 1) {
      this.shaders[index].setVisible(false);
    }
  }

  destroy(): void {
    for (const shader of this.shaders) shader.destroy();
    this.shaders.length = 0;
    this.pointDataCache.clear();
    this.regionBoundsCache.clear();
  }

  private ensureShaderCached(): void {
    if (this.scene.cache.shader.has(SHADER_KEY)) return;
    this.scene.cache.shader.add(
      SHADER_KEY,
      new Phaser.Display.BaseShader(SHADER_KEY, fragmentShader, undefined, {
        u_alpha: { type: '1f', value: 1 },
        u_feather: { type: '1f', value: 1 },
        u_point_count: { type: '1i', value: 0 },
        u_region_origin: { type: '2f', value: { x: 0, y: 0 } },
        u_region_points: { type: '2fv', value: new Float32Array(MAX_REGION_POINTS * 2) },
        u_seed: { type: '1f', value: this.seed },
        u_world: { type: '2f', value: { x: 1, y: 1 } },
      }),
    );
  }

  private ensureShaderPool(count: number): void {
    while (this.shaders.length < count) {
      this.shaders.push(
        this.scene.add
          .shader(SHADER_KEY, 0, 0, 1, 1)
          .setOrigin(0, 0)
          .setScrollFactor(1)
          .setDepth(NEBULA_REGION_DEPTH),
      );
    }
  }

  private renderCopies(copies: RegionCopy[], world: WorldSize): void {
    for (let index = 0; index < copies.length; index += 1) {
      const copy = copies[index];
      const shader = this.shaders[index];
      shader
        .setPosition(copy.bounds.x, copy.bounds.y)
        .setSize(copy.bounds.width, copy.bounds.height)
        .setUniform('u_alpha.value', copy.region.alpha)
        .setUniform('u_feather.value', copy.region.featherPx)
        .setUniform('u_point_count.value', copy.pointCount)
        .setUniform('u_region_origin.value.x', copy.bounds.x)
        .setUniform('u_region_origin.value.y', copy.bounds.y)
        .setUniform('u_region_points.value', copy.pointData)
        .setUniform('u_seed.value', this.seed)
        .setUniform('u_world.value.x', world.width)
        .setUniform('u_world.value.y', world.height)
        .setVisible(copy.pointCount > 0);
    }
  }

  private getPointData(region: NebulaRegion, offset: Vector): Float32Array {
    const key = `${region.id}:${offset.x}:${offset.y}`;
    const cached = this.pointDataCache.get(key);
    if (cached) return cached;

    const data = getPointData(region.points, offset);
    this.pointDataCache.set(key, data);
    return data;
  }

  private getRegionBounds(region: NebulaRegion): RegionBounds {
    const cached = this.regionBoundsCache.get(region.id);
    if (cached) return cached;

    const bounds = getRegionBounds(region.points, region.featherPx);
    this.regionBoundsCache.set(region.id, bounds);
    return bounds;
  }
}

function getVisibleRegionCopies(
  regions: NebulaRegion[],
  world: WorldSize,
  viewport: RegionBounds,
  cache: {
    getPointData: (region: NebulaRegion, offset: Vector) => Float32Array;
    getRegionBounds: (region: NebulaRegion) => RegionBounds;
  },
): RegionCopy[] {
  const copies: RegionCopy[] = [];
  for (const region of regions) {
    const baseBounds = cache.getRegionBounds(region);
    for (const offsetX of COPY_OFFSETS) {
      for (const offsetY of COPY_OFFSETS) {
        const offset = { x: offsetX * world.width, y: offsetY * world.height };
        const copyBounds = {
          height: baseBounds.height,
          width: baseBounds.width,
          x: baseBounds.x + offset.x,
          y: baseBounds.y + offset.y,
        };
        const bounds = getBoundsIntersection(copyBounds, viewport);
        if (bounds) {
          copies.push({
            bounds,
            pointCount: Math.min(region.points.length, MAX_REGION_POINTS),
            pointData: cache.getPointData(region, offset),
            region,
          });
        }
      }
    }
  }
  return copies;
}

function getRegionBounds(points: Vector[], feather: number): RegionBounds {
  const bounds = points.reduce(
    (current, point) => ({
      maxX: Math.max(current.maxX, point.x),
      maxY: Math.max(current.maxY, point.y),
      minX: Math.min(current.minX, point.x),
      minY: Math.min(current.minY, point.y),
    }),
    {
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
    },
  );
  return {
    height: bounds.maxY - bounds.minY + feather * 2,
    width: bounds.maxX - bounds.minX + feather * 2,
    x: bounds.minX - feather,
    y: bounds.minY - feather,
  };
}

function getBoundsIntersection(left: RegionBounds, right: RegionBounds): RegionBounds | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const rightEdge = Math.min(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.min(left.y + left.height, right.y + right.height);
  const width = rightEdge - x;
  const height = bottomEdge - y;
  if (width <= 1 || height <= 1) return null;
  return { height, width, x, y };
}

function getPointData(points: Vector[], offset: Vector): Float32Array {
  const data = new Float32Array(MAX_REGION_POINTS * 2);
  const count = Math.min(points.length, MAX_REGION_POINTS);
  for (let index = 0; index < count; index += 1) {
    data[index * 2] = points[index].x + offset.x;
    data[index * 2 + 1] = points[index].y + offset.y;
  }
  return data;
}
