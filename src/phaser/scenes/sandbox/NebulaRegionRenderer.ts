import Phaser from 'phaser';

import type { Vector, WorldSize } from '../../core/types';
import { nebulaNoiseShader } from '../../world/nebulaShader';
import type { NebulaRegion, NebulaRegionColor, NebulaRegionVisuals } from './nebulaRegions';

const MAX_REGION_POINTS = 12;
const NEBULA_CHUNK_SIZE = 960;
const NEBULA_REGION_DEPTH = 20;
const SHADER_KEY = 'sandbox-nebula-region-shader-v11';
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

type ShaderRenderTargetState = Omit<Phaser.GameObjects.Shader, 'renderToTexture' | 'texture'> & {
  renderToTexture: boolean;
  texture: Phaser.Textures.Texture | null;
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
  float amplitude = 0.5;
  for (int i = 0; i < 6; i++) {
    value += noisePeriodic(p, period) * amplitude;
    p = p * 2.0 + vec2(17.3, 9.7);
    period *= 2.0;
    amplitude *= 0.52;
  }
  return value;
}

vec4 sampleRegionNebula(vec2 worldPosition, float alphaScale) {
  const float TAU = 6.28318530718;
  vec2 tileUv = fract(worldPosition / max(u_world, vec2(1.0)));
  vec2 basePeriod = max(vec2(4.0), floor(u_world / 240.0 + 0.5));
  vec2 waveCycles = max(vec2(1.0), floor(basePeriod * 0.5));
  vec2 seedOffset = vec2(u_region_seed * 0.011, u_region_seed * 0.017);

  vec2 wave = vec2(
    sin((tileUv.y * waveCycles.y + tileUv.x) * TAU + sin(tileUv.x * TAU) * 0.7 + seedOffset.x),
    cos((tileUv.x * waveCycles.x - tileUv.y) * TAU + sin(tileUv.y * TAU) * 0.55 + seedOffset.y)
  );
  vec2 ribbonFlow = vec2(
    sin((tileUv.x + tileUv.y * waveCycles.y) * TAU + seedOffset.y),
    cos((tileUv.x * waveCycles.x + tileUv.y) * TAU + seedOffset.x)
  );
  vec2 curve = wave * 0.045 + ribbonFlow * 0.015;
  vec2 p = tileUv * basePeriod + curve + seedOffset;

  vec2 warp = vec2(
    fbmRegion(p + vec2(2.0, 3.0), basePeriod),
    fbmRegion(p + vec2(5.0, 1.0), basePeriod)
  );
  vec2 q = p + (warp - 0.5) * 0.62 + curve * 0.22;
  float broad = fbmRegion(q + vec2(1.0, 2.0), basePeriod);
  float cloud = fbmRegion(q + warp * 0.65 + vec2(6.0, 4.0), basePeriod);
  float detail = fbmRegion(q * 4.0 + warp * 2.0, basePeriod * 4.0);
  float filamentA = fbmRegion(q * vec2(4.0, 2.0) + curve * 2.0, basePeriod * vec2(4.0, 2.0));
  float filamentB = fbmRegion(q * vec2(2.0, 4.0) - curve * 2.0, basePeriod * vec2(2.0, 4.0));
  float colorNoise = fbmRegion(q * 2.0 + 11.0, basePeriod * 2.0);
  float ribbon = sin((tileUv.x * waveCycles.x + tileUv.y) * TAU + warp.x * 0.35 + detail * 0.12) * 0.5 + 0.5;
  float ridge = 1.0 - abs(detail * 2.0 - 1.0);
  float cloudMass = broad * 0.62 + cloud * 0.38;
  float filamentBlend = (filamentA + filamentB) * 0.5;
  float filaments = filamentBlend * 0.72 + ridge * 0.18 + ribbon * 0.02;
  float thread = smoothstep(0.68, 0.98, filaments * 0.62 + ridge * 0.18 + ribbon * 0.012);
  float nebula = smoothstep(0.34, 0.86, cloudMass * 0.92 + ridge * 0.1 + thread * 0.055);
  float core = smoothstep(0.68, 1.0, cloudMass * 0.82 + detail * 0.1 + thread * 0.06);
  float haze = smoothstep(0.26, 0.84, cloudMass * 0.72 + cloud * 0.16 + detail * 0.08);
  float density = max(nebula, haze * u_haze_strength);

  vec3 deep = u_color_blue * 0.08;
  vec3 nebulaColor = mix(u_color_blue, u_color_violet, smoothstep(0.28, 0.82, colorNoise));
  nebulaColor = mix(nebulaColor, u_color_cyan, smoothstep(0.62, 0.96, detail) * 0.28);

  vec3 color = deep + nebulaColor * density * u_density_scale * 1.08;
  color += u_color_highlight * core * u_core_strength;
  color += mix(nebulaColor, u_color_highlight, 0.45) * thread * 0.12;
  color += u_color_cyan * ribbon * nebula * 0.018;
  color = pow(max(color, vec3(0.0)), vec3(1.06));
  return vec4(color, clamp((density * 0.94 + core * 0.28 + thread * 0.16) * alphaScale, 0.0, 1.0));
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
  vec2 localPixel = gl_FragCoord.xy - vec2(0.5);
  vec2 worldPosition = u_region_origin + localPixel;
  float edgeDistance = polygonEdgeDistance(worldPosition);
  float mask = polygonMask(worldPosition);

  if (mask <= VISIBLE_ALPHA_THRESHOLD) {
    discard;
  }

  vec4 nebula = sampleRegionNebula(worldPosition, u_alpha_scale);
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

type NebulaRegionPrepareInput = {
  center: Vector;
  regions: NebulaRegion[];
  screen: WorldSize;
  world: WorldSize;
};

export class NebulaRegionRenderer {
  private readonly copiedPointsCache = new Map<string, Vector[]>();
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
      getCopiedPoints: (region, offset) => this.getCopiedPoints(region, offset),
      getPointData: (region, offset) => this.getPointData(region, offset),
      getRegionBounds: (region) => this.getRegionBounds(region),
    });
    this.renderCachedCopies(copies, input.world);
  }

  prepareTextures(input: NebulaRegionPrepareInput): void {
    this.ensureShaderCached();
    const viewport = {
      height: input.screen.height,
      width: input.screen.width,
      x: input.center.x - input.screen.width * 0.5,
      y: input.center.y - input.screen.height * 0.5,
    };
    const copies = getVisibleRegionCopies(input.regions, input.world, viewport, {
      getCopiedPoints: (region, offset) => this.getCopiedPoints(region, offset),
      getPointData: (region, offset) => this.getPointData(region, offset),
      getRegionBounds: (region) => this.getRegionBounds(region),
    });
    for (const copy of copies) {
      if (!this.scene.textures.exists(copy.cacheKey)) this.bakeChunkTexture(copy, input.world);
    }
  }

  destroy(): void {
    for (const cachedChunk of this.chunkCache.values()) {
      cachedChunk.image.destroy();
      if (this.scene.textures.exists(cachedChunk.textureKey)) {
        this.scene.textures.remove(cachedChunk.textureKey);
      }
    }
    this.copiedPointsCache.clear();
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

    const textureKey = this.scene.textures.exists(copy.cacheKey)
      ? copy.cacheKey
      : this.bakeChunkTexture(copy, world);
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
    const renderer = this.scene.sys.renderer;
    const gl = renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer ? renderer.gl : null;
    const scissorEnabled = gl?.isEnabled(gl.SCISSOR_TEST) ?? false;
    if (gl) gl.disable(gl.SCISSOR_TEST);
    shader.setRenderToTexture(sourceTextureKey);
    this.copyShaderTexture(shader, copy.cacheKey, copy.bounds);
    this.destroyShaderRenderTarget(shader, sourceTextureKey);
    if (gl && scissorEnabled) gl.enable(gl.SCISSOR_TEST);
    shader.destroy();
    return copy.cacheKey;
  }

  private destroyShaderRenderTarget(shader: Phaser.GameObjects.Shader, textureKey: string): void {
    const renderer = this.scene.sys.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
    if (!shader.framebuffer) return;

    const gl = renderer.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, shader.framebuffer.webGLFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(shader.framebuffer.webGLFramebuffer);
    const framebufferIndex = renderer.glFramebufferWrappers.indexOf(shader.framebuffer);
    if (framebufferIndex >= 0) renderer.glFramebufferWrappers.splice(framebufferIndex, 1);
    const stackIndex = renderer.fboStack.indexOf(shader.framebuffer);
    if (stackIndex >= 0) renderer.fboStack.splice(stackIndex, 1);
    if (this.scene.textures.exists(textureKey)) this.scene.textures.remove(textureKey);

    const renderTargetShader = shader as ShaderRenderTargetState;
    renderTargetShader.renderToTexture = false;
    renderTargetShader.framebuffer = null;
    renderTargetShader.glTexture = null;
    renderTargetShader.texture = null;
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
      false,
      true,
      false,
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

  private getCopiedPoints(region: NebulaRegion, offset: Vector): Vector[] {
    const key = `${region.id}:${offset.x}:${offset.y}`;
    const cached = this.copiedPointsCache.get(key);
    if (cached) return cached;

    const copiedPoints = region.points.map((point) => ({
      x: point.x + offset.x,
      y: point.y + offset.y,
    }));
    this.copiedPointsCache.set(key, copiedPoints);
    return copiedPoints;
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
    getCopiedPoints: (region: NebulaRegion, offset: Vector) => Vector[];
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
        const visibleBounds = getBoundsIntersection(copyBounds, viewport);
        const offsetKey = `${offset.x}:${offset.y}`;
        if (visibleBounds) {
          copies.push(
            ...getVisibleChunkCopies({
              copiedPoints: cache.getCopiedPoints(region, offset),
              offsetKey,
              pointData: cache.getPointData(region, offset),
              region,
              visibleBounds,
            }),
          );
        }
      }
    }
  }
  return copies;
}

function getVisibleChunkCopies(input: {
  copiedPoints: Vector[];
  offsetKey: string;
  pointData: Float32Array;
  region: NebulaRegion;
  visibleBounds: RegionBounds;
}): RegionCopy[] {
  const chunks: RegionCopy[] = [];
  const startX = Math.floor(input.visibleBounds.x / NEBULA_CHUNK_SIZE) * NEBULA_CHUNK_SIZE;
  const endX = input.visibleBounds.x + input.visibleBounds.width;
  const startY = Math.floor(input.visibleBounds.y / NEBULA_CHUNK_SIZE) * NEBULA_CHUNK_SIZE;
  const endY = input.visibleBounds.y + input.visibleBounds.height;
  for (let chunkY = startY; chunkY < endY; chunkY += NEBULA_CHUNK_SIZE) {
    for (let chunkX = startX; chunkX < endX; chunkX += NEBULA_CHUNK_SIZE) {
      const chunkBounds = {
        height: NEBULA_CHUNK_SIZE,
        width: NEBULA_CHUNK_SIZE,
        x: chunkX,
        y: chunkY,
      };
      const visibleChunkBounds = getBoundsIntersection(chunkBounds, input.visibleBounds);
      if (visibleChunkBounds && polygonIntersectsBounds(input.copiedPoints, visibleChunkBounds)) {
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
