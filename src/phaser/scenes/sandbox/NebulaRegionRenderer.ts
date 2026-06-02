import Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';
import { nebulaNoiseShader } from '../../world/nebulaShader';
import type { NebulaRegion, NebulaRegionColor, NebulaRegionVisuals } from './nebulaRegions';

const MAX_REGION_POINTS = 12;
const NEBULA_REGION_DEPTH = 20;
const SHADER_KEY = 'sandbox-nebula-region-shader-v7';
const COPY_OFFSETS = [-1, 0, 1] as const;
const VISIBLE_ALPHA_THRESHOLD = 0.003;
const DEFAULT_NEBULA_VISUALS: NebulaRegionVisuals = {
  alphaScale: 1.22,
  blue: { b: 0.576, g: 0.22, r: 0.078 },
  coreStrength: 0.34,
  cyan: { b: 0.62, g: 0.502, r: 0.078 },
  densityScale: 1.28,
  hazeStrength: 0.42,
  highlight: { b: 0.937, g: 0.678, r: 0.361 },
  tint: { b: 0.878, g: 0.78, r: 0.259 },
  tintStrength: 0.42,
  violet: { b: 0.478, g: 0.11, r: 0.278 },
};

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

type Vec3Uniform = {
  x: number;
  y: number;
  z: number;
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
    nearestDistance = min(nearestDistance, abs(inwardDistance));
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
uniform float u_alpha_scale;
uniform float u_core_strength;
uniform float u_density_scale;
uniform float u_haze_strength;
uniform float u_tint_strength;
uniform vec3 u_color_blue;
uniform vec3 u_color_cyan;
uniform vec3 u_color_highlight;
uniform vec3 u_color_tint;
uniform vec3 u_color_violet;
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
  float density = max(nebula, haze * u_haze_strength);

  vec3 color = mix(u_color_blue, u_color_violet, smoothstep(0.25, 0.82, colorNoise));
  color = mix(color, u_color_cyan, smoothstep(0.46, 0.9, detail) * 0.52);
  color = color * (density * u_density_scale + 0.16) + u_color_highlight * core * u_core_strength;
  return vec4(color, clamp((density * 1.05 + core * 0.52 + 0.28) * alphaScale, 0.0, 1.0));
}

float polygonMask(vec2 worldPosition) {
  bool inside = false;
${Array.from({ length: MAX_REGION_POINTS }, (_, pointIndex) => createEdgeShader(pointIndex)).join('\n')}

  return (inside ? 1.0 : 0.0) * u_alpha;
}

float polygonEdgeDistance(vec2 worldPosition) {
  float nearestDistance = 1000000.0;
${Array.from({ length: MAX_REGION_POINTS }, (_, pointIndex) => createSignedEdgeDistanceShader(pointIndex)).join('\n')}

  return nearestDistance;
}

void main() {
  vec2 localPixel = vec2(fragCoord.x, resolution.y - fragCoord.y);
  vec2 worldPosition = u_region_origin + localPixel;
  vec2 world01 = fract(worldPosition / max(u_world, vec2(1.0)));
  float edgeDistance = polygonEdgeDistance(worldPosition);
  float mask = polygonMask(worldPosition);

  if (mask <= VISIBLE_ALPHA_THRESHOLD) {
    discard;
  }

  vec4 nebula = sampleRegionNebula(world01, u_alpha_scale);
  if (nebula.a <= VISIBLE_ALPHA_THRESHOLD) {
    discard;
  }

  float edgeFade = smoothstep(0.0, max(u_feather, 1.0), edgeDistance);
  float effectiveAlpha = nebula.a * mask * edgeFade;
  vec3 color = mix(nebula.rgb, u_color_tint, u_tint_strength);
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
        u_alpha_scale: { type: '1f', value: DEFAULT_NEBULA_VISUALS.alphaScale },
        u_color_blue: { type: '3f', value: toVec3Uniform(DEFAULT_NEBULA_VISUALS.blue) },
        u_color_cyan: { type: '3f', value: toVec3Uniform(DEFAULT_NEBULA_VISUALS.cyan) },
        u_color_highlight: {
          type: '3f',
          value: toVec3Uniform(DEFAULT_NEBULA_VISUALS.highlight),
        },
        u_color_tint: { type: '3f', value: toVec3Uniform(DEFAULT_NEBULA_VISUALS.tint) },
        u_color_violet: { type: '3f', value: toVec3Uniform(DEFAULT_NEBULA_VISUALS.violet) },
        u_core_strength: { type: '1f', value: DEFAULT_NEBULA_VISUALS.coreStrength },
        u_density_scale: { type: '1f', value: DEFAULT_NEBULA_VISUALS.densityScale },
        u_feather: { type: '1f', value: 1 },
        u_haze_strength: { type: '1f', value: DEFAULT_NEBULA_VISUALS.hazeStrength },
        u_point_count: { type: '1i', value: 0 },
        u_region_origin: { type: '2f', value: { x: 0, y: 0 } },
        u_region_points: { type: '2fv', value: new Float32Array(MAX_REGION_POINTS * 2) },
        u_seed: { type: '1f', value: this.seed },
        u_tint_strength: { type: '1f', value: DEFAULT_NEBULA_VISUALS.tintStrength },
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
      const visuals = copy.region.visuals ?? DEFAULT_NEBULA_VISUALS;
      shader
        .setPosition(copy.bounds.x, copy.bounds.y)
        .setSize(copy.bounds.width, copy.bounds.height)
        .setUniform('u_alpha.value', copy.region.alpha)
        .setUniform('u_alpha_scale.value', visuals.alphaScale)
        .setUniform('u_core_strength.value', visuals.coreStrength)
        .setUniform('u_density_scale.value', visuals.densityScale)
        .setUniform('u_feather.value', copy.region.featherPx)
        .setUniform('u_haze_strength.value', visuals.hazeStrength)
        .setUniform('u_point_count.value', copy.pointCount)
        .setUniform('u_region_origin.value.x', copy.bounds.x)
        .setUniform('u_region_origin.value.y', copy.bounds.y)
        .setUniform('u_region_points.value', copy.pointData)
        .setUniform('u_seed.value', this.seed)
        .setUniform('u_tint_strength.value', visuals.tintStrength)
        .setUniform('u_world.value.x', world.width)
        .setUniform('u_world.value.y', world.height)
        .setVisible(copy.pointCount > 0);
      setColorUniform(shader, 'u_color_blue', visuals.blue);
      setColorUniform(shader, 'u_color_cyan', visuals.cyan);
      setColorUniform(shader, 'u_color_highlight', visuals.highlight);
      setColorUniform(shader, 'u_color_tint', visuals.tint);
      setColorUniform(shader, 'u_color_violet', visuals.violet);
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

function setColorUniform(
  shader: Phaser.GameObjects.Shader,
  name: string,
  color: NebulaRegionColor,
): void {
  shader
    .setUniform(`${name}.value.x`, color.r)
    .setUniform(`${name}.value.y`, color.g)
    .setUniform(`${name}.value.z`, color.b);
}

function toVec3Uniform(color: NebulaRegionColor): Vec3Uniform {
  return { x: color.r, y: color.g, z: color.b };
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
