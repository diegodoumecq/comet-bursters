import Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';
import { nebulaNoiseShader } from '../../world/nebulaShader';
import type { NebulaRegion, NebulaRegionColor, NebulaRegionVisuals } from './nebulaRegions';

const MAX_REGION_POINTS = 12;
const NEBULA_CHUNK_SIZE = 960;
const NEBULA_REGION_DEPTH = 20;
const SHADER_KEY = 'sandbox-nebula-region-shader-v9';
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
  cacheKey: string;
  pointData: Float32Array;
  pointCount: number;
  region: NebulaRegion;
};

type CachedChunk = {
  image: Phaser.GameObjects.Image;
  textureKey: string;
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
precision highp float;

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
uniform float u_region_seed;
uniform float u_seed;
uniform vec2 u_world;

varying vec2 fragCoord;

${nebulaNoiseShader}

const float VISIBLE_ALPHA_THRESHOLD = ${VISIBLE_ALPHA_THRESHOLD.toFixed(3)};

float fbmRegion(vec2 p, vec2 period) {
  float value = 0.0;
  float amplitude = 0.56;
  for (int i = 0; i < 4; i++) {
    value += noisePeriodic(p, period) * amplitude;
    p = p * 2.0 + vec2(17.3, 9.7);
    period *= 2.0;
    amplitude *= 0.52;
  }
  return value;
}

vec4 sampleRegionNebula(vec2 world01, float alphaScale) {
  const float TAU = 6.28318530718;
  vec2 seedOffset = vec2(u_region_seed * 0.137, u_region_seed * 0.071);
  vec2 p = world01 * 34.0 + seedOffset;

  vec2 wave = vec2(
    sin((p.y * 0.42 + p.x * 0.08) * TAU + u_region_seed * 0.013),
    cos((p.x * 0.36 - p.y * 0.1) * TAU + u_region_seed * 0.017)
  );
  vec2 ribbonFlow = vec2(
    sin((p.x * 0.24 + p.y * 0.4) * TAU),
    cos((p.x * 0.4 + p.y * 0.22) * TAU)
  );
  vec2 curve = wave * 0.18 + ribbonFlow * 0.055;
  vec2 basePeriod = vec2(48.0);

  vec2 warp = vec2(
    fbmRegion(p + curve + vec2(2.0, 3.0), basePeriod),
    fbmRegion(p - curve + vec2(5.0, 1.0), basePeriod)
  );
  vec2 q = p + (warp - 0.5) * 1.05 + curve * 0.45;
  float cloud = fbmRegion(q + warp * 0.85 + vec2(1.0, 2.0), basePeriod);
  float detail = fbmRegion(q * 4.0 + warp * 2.4, basePeriod * 4.0);
  float ribbon = sin((world01.x * 11.0 + world01.y * 7.0) * TAU + warp.x * 1.4 + detail * 0.55) * 0.5 + 0.5;
  float ridge = 1.0 - abs(detail * 2.0 - 1.0);
  float cloudMass = cloud;
  float thread = smoothstep(0.56, 0.94, ridge * 0.58 + ribbon * 0.24 + detail * 0.18);
  float nebula = smoothstep(0.28, 0.82, cloudMass * 0.9 + ridge * 0.14 + thread * 0.08);
  float core = smoothstep(0.62, 0.98, cloudMass * 0.78 + detail * 0.16 + thread * 0.12);
  float haze = smoothstep(0.16, 0.72, cloudMass * 0.68 + detail * 0.24 + 0.18);
  float density = max(nebula, haze * u_haze_strength);

  float colorVariance = clamp(cloudMass * 0.22 + detail * 0.42 + ribbon * 0.34 + ridge * 0.28, 0.0, 1.0);
  float hueSplit = smoothstep(0.04, 0.66, colorVariance);
  float cyanSplit = smoothstep(0.18, 0.72, detail * 0.52 + ridge * 0.48);
  vec3 color = mix(u_color_blue, u_color_violet, hueSplit);
  color = mix(color, u_color_cyan, cyanSplit * 0.86);
  color = mix(color, u_color_highlight, clamp(thread * 0.34 + core * 0.16 + ridge * 0.08, 0.0, 0.58));
  color = color * (density * u_density_scale + 0.09);
  color += u_color_highlight * core * u_core_strength;
  color += mix(color, u_color_highlight, 0.5) * thread * 0.18;
  color += u_color_cyan * ribbon * density * 0.045;
  return vec4(color, clamp((density * 0.96 + core * 0.42 + thread * 0.22) * alphaScale, 0.0, 1.0));
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
  vec2 localPixel = gl_FragCoord.xy;
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
  private readonly chunkCache = new Map<string, CachedChunk>();
  private readonly pointDataCache = new Map<string, Float32Array>();
  private readonly regionBoundsCache = new Map<string, RegionBounds>();

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
    this.renderCachedCopies(copies, input.world);
  }

  destroy(): void {
    for (const cachedChunk of this.chunkCache.values()) {
      cachedChunk.image.destroy();
      if (this.scene.textures.exists(cachedChunk.textureKey)) {
        this.scene.textures.remove(cachedChunk.textureKey);
      }
    }
    this.chunkCache.clear();
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
        u_region_seed: { type: '1f', value: 1 },
        u_seed: { type: '1f', value: 1 },
        u_tint_strength: { type: '1f', value: DEFAULT_NEBULA_VISUALS.tintStrength },
        u_world: { type: '2f', value: { x: 1, y: 1 } },
      }),
    );
  }

  private renderCachedCopies(copies: RegionCopy[], world: WorldSize): void {
    const visibleKeys = new Set<string>();
    for (const copy of copies) {
      const cachedChunk = this.getOrCreateCachedChunk(copy, world);
      cachedChunk.image.setVisible(true);
      visibleKeys.add(copy.cacheKey);
    }
    for (const [cacheKey, cachedChunk] of this.chunkCache) {
      if (!visibleKeys.has(cacheKey)) cachedChunk.image.setVisible(false);
    }
  }

  private getOrCreateCachedChunk(copy: RegionCopy, world: WorldSize): CachedChunk {
    const cachedChunk = this.chunkCache.get(copy.cacheKey);
    if (cachedChunk) return cachedChunk;

    const textureKey = this.bakeChunkTexture(copy, world);
    const image = this.scene.add
      .image(copy.bounds.x, copy.bounds.y, textureKey)
      .setOrigin(0, 0)
      .setScrollFactor(1)
      .setDepth(NEBULA_REGION_DEPTH);
    const createdChunk = { image, textureKey };
    this.chunkCache.set(copy.cacheKey, createdChunk);
    return createdChunk;
  }

  private bakeChunkTexture(copy: RegionCopy, world: WorldSize): string {
    const visuals = copy.region.visuals ?? DEFAULT_NEBULA_VISUALS;
    const shader = this.scene.add
      .shader(
        SHADER_KEY,
        copy.bounds.width / 2,
        copy.bounds.height / 2,
        copy.bounds.width,
        copy.bounds.height,
      )
      .setScrollFactor(1)
      .setDepth(NEBULA_REGION_DEPTH)
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
      .setUniform('u_region_seed.value', copy.region.seed)
      .setUniform('u_seed.value', copy.region.seed)
      .setUniform('u_tint_strength.value', visuals.tintStrength)
      .setUniform('u_world.value.x', world.width)
      .setUniform('u_world.value.y', world.height);
    setColorUniform(shader, 'u_color_blue', visuals.blue);
    setColorUniform(shader, 'u_color_cyan', visuals.cyan);
    setColorUniform(shader, 'u_color_highlight', visuals.highlight);
    setColorUniform(shader, 'u_color_tint', visuals.tint);
    setColorUniform(shader, 'u_color_violet', visuals.violet);

    const sourceTextureKey = `${copy.cacheKey}:source`;
    shader.setRenderToTexture(sourceTextureKey);
    this.copyShaderTexture(shader, copy.cacheKey, copy.bounds);
    shader.destroy();
    return copy.cacheKey;
  }

  private copyShaderTexture(
    shader: Phaser.GameObjects.Shader,
    textureKey: string,
    bounds: RegionBounds,
  ): void {
    const renderer = this.scene.sys.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
    if (!shader.framebuffer) return;

    const gl = renderer.gl;
    const copiedTexture = renderer.createTexture2D(
      0,
      gl.NEAREST,
      gl.NEAREST,
      gl.CLAMP_TO_EDGE,
      gl.CLAMP_TO_EDGE,
      gl.RGBA,
      undefined,
      bounds.width,
      bounds.height,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, shader.framebuffer.webGLFramebuffer);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, copiedTexture.webGLTexture);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, bounds.width, bounds.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    renderer.pipelines.rebind();
    this.scene.textures.addGLTexture(textureKey, copiedTexture);
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
        const copiedPoints = region.points.map((point) => ({
          x: point.x + offset.x,
          y: point.y + offset.y,
        }));
        const offsetKey = `${offset.x}:${offset.y}`;
        copies.push(
          ...getVisibleChunkCopies({
            copyBounds,
            copiedPoints,
            region,
            viewport,
            offsetKey,
            pointData: cache.getPointData(region, offset),
          }),
        );
      }
    }
  }
  return copies;
}

function getVisibleChunkCopies(input: {
  copiedPoints: Vector[];
  copyBounds: RegionBounds;
  offsetKey: string;
  pointData: Float32Array;
  region: NebulaRegion;
  viewport: RegionBounds;
}): RegionCopy[] {
  const visibleBounds = getBoundsIntersection(input.copyBounds, input.viewport);
  if (!visibleBounds) return [];

  const chunks: RegionCopy[] = [];
  const startX = Math.floor(visibleBounds.x / NEBULA_CHUNK_SIZE) * NEBULA_CHUNK_SIZE;
  const endX = visibleBounds.x + visibleBounds.width;
  const startY = Math.floor(visibleBounds.y / NEBULA_CHUNK_SIZE) * NEBULA_CHUNK_SIZE;
  const endY = visibleBounds.y + visibleBounds.height;
  for (let chunkY = startY; chunkY < endY; chunkY += NEBULA_CHUNK_SIZE) {
    for (let chunkX = startX; chunkX < endX; chunkX += NEBULA_CHUNK_SIZE) {
      const chunkBounds = {
        height: NEBULA_CHUNK_SIZE,
        width: NEBULA_CHUNK_SIZE,
        x: chunkX,
        y: chunkY,
      };
      const visibleChunkBounds = getBoundsIntersection(chunkBounds, visibleBounds);
      if (
        visibleChunkBounds &&
        polygonIntersectsBounds(input.copiedPoints, visibleChunkBounds)
      ) {
        const bounds = normalizeBounds(chunkBounds);
        chunks.push({
          bounds,
          cacheKey: getChunkCacheKey(input.region, bounds, input.offsetKey),
          pointCount: Math.min(input.region.points.length, MAX_REGION_POINTS),
          pointData: input.pointData,
          region: input.region,
        });
      }
    }
  }
  return chunks;
}

function normalizeBounds(bounds: RegionBounds): RegionBounds {
  const x = Math.floor(bounds.x);
  const y = Math.floor(bounds.y);
  const right = Math.ceil(bounds.x + bounds.width);
  const bottom = Math.ceil(bounds.y + bounds.height);
  return {
    height: bottom - y,
    width: right - x,
    x,
    y,
  };
}

function getChunkCacheKey(region: NebulaRegion, bounds: RegionBounds, offsetKey: string): string {
  return [
    'sandbox-nebula-chunk',
    region.id,
    region.seed,
    offsetKey,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  ].join(':');
}

function polygonIntersectsBounds(points: Vector[], bounds: RegionBounds): boolean {
  const polygonVertexInside = points.some((point) => pointInsideBounds(point, bounds));
  if (polygonVertexInside) return true;

  const boundsCorners = getBoundsCorners(bounds);
  const boundsCornerInside = boundsCorners.some((point) => pointInPolygon(point, points));
  if (boundsCornerInside) return true;

  const boundsEdges = getBoundsEdges(bounds);
  let intersects = false;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    for (const edge of boundsEdges) {
      if (segmentsIntersect(start, end, edge.start, edge.end)) intersects = true;
    }
  }
  return intersects;
}

function pointInsideBounds(point: Vector, bounds: RegionBounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function getBoundsCorners(bounds: RegionBounds): Vector[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

function getBoundsEdges(bounds: RegionBounds): { end: Vector; start: Vector }[] {
  const corners = getBoundsCorners(bounds);
  return corners.map((start, index) => ({ end: corners[(index + 1) % corners.length], start }));
}

function segmentsIntersect(a: Vector, b: Vector, c: Vector, d: Vector): boolean {
  const denominator = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);
  if (Math.abs(denominator) < 0.0001) return false;
  const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denominator;
  const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denominator;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

function pointInPolygon(point: Vector, polygon: Vector[]): boolean {
  let inside = false;
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const denominator = previous.y - current.y;
    const intersectionX =
      ((previous.x - current.x) * (point.y - current.y)) /
        (Math.abs(denominator) < 0.0001 ? 0.0001 : denominator) +
      current.x;
    if (crossesY && point.x < intersectionX) inside = !inside;
  }
  return inside;
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
