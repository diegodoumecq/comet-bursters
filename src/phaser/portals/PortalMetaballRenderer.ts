import Phaser from 'phaser';

import type { PortalEntity } from '../dimensions/types';
import { buildPortalMetaballData, PORTAL_METABALL_COUNT } from './PortalMetaballSamples';
import { markPortalCaptureExcluded } from './PortalSceneCapture';

const PORTAL_METABALL_SHADER_KEY = 'portal-metaball-window-v2';
const VISIBLE_ALPHA_THRESHOLD = 0.004;

const fragmentShader = `
precision mediump float;

uniform float u_alpha;
uniform float u_time;
uniform vec4 u_metaballs[${PORTAL_METABALL_COUNT}];
uniform vec2 u_center;
uniform vec2 u_normal;
uniform vec2 u_radius;
uniform vec2 u_region_origin;
uniform vec2 u_screen;
uniform sampler2D iChannel0;
uniform vec2 resolution;

varying vec2 fragCoord;

const float VISIBLE_ALPHA_THRESHOLD = ${VISIBLE_ALPHA_THRESHOLD.toFixed(3)};

void main() {
  vec2 pixel = vec2(fragCoord.x, resolution.y - fragCoord.y);
  vec2 worldPosition = u_region_origin + pixel;
  vec2 tangent = vec2(-u_normal.y, u_normal.x);
  vec2 delta = worldPosition - u_center;
  vec2 localPosition = vec2(dot(delta, tangent), dot(delta, u_normal));
  vec2 radius = max(u_radius, vec2(1.0));

  float field = 0.0;
  float glowField = 0.0;
  float directionalLight = 0.0;

  for (int index = 0; index < ${PORTAL_METABALL_COUNT}; index++) {
    vec4 metaball = u_metaballs[index];
    vec2 point = metaball.xy;
    float blobRadius = metaball.z;
    float side = metaball.w;
    float dist = length(localPosition - point);
    float kernel = max(0.0, 1.0 - dist / max(blobRadius, 1.0));
    float contribution = kernel * kernel * (3.0 - 2.0 * kernel);
    field += contribution;
    glowField += contribution * (0.7 + max(side, 0.0) * 0.35);
    directionalLight += contribution * smoothstep(-0.35, 1.0, side);
  }

  float normalizedEllipse = length(localPosition / radius);
  float portalGate = 1.0 - smoothstep(1.08, 1.28, normalizedEllipse);
  float body = smoothstep(0.5, 0.58, field) * portalGate;
  float contour = (smoothstep(0.28, 0.36, field) - smoothstep(0.58, 0.68, field)) * portalGate;
  float border = (smoothstep(0.38, 0.5, field) - smoothstep(0.58, 0.72, field)) * portalGate;
  float outerBorder = (smoothstep(0.16, 0.24, field) - smoothstep(0.34, 0.44, field)) *
    portalGate;
  float core = smoothstep(0.9, 1.18, field) * portalGate;
  float glow = smoothstep(0.12, 0.22, glowField) * portalGate * 0.08;

  float forward = smoothstep(-0.7, 1.0, localPosition.y / radius.y);
  float light = clamp(directionalLight / max(field, 0.001), 0.0, 1.0);
  vec3 shadow = vec3(0.015, 0.02, 0.07);
  vec3 violet = vec3(0.42, 0.12, 0.86);
  vec3 cyan = vec3(0.08, 0.82, 1.0);
  vec3 ember = vec3(1.0, 0.34, 0.08);
  vec2 sourceUv = vec2(
    clamp(worldPosition.x / max(u_screen.x, 1.0), 0.0, 1.0),
    1.0 - clamp(worldPosition.y / max(u_screen.y, 1.0), 0.0, 1.0)
  );
  vec4 sourceColor = texture2D(iChannel0, sourceUv);
  vec3 rimColor = mix(shadow, violet, 0.42 + light * 0.28);
  rimColor = mix(rimColor, cyan, forward * 0.44 + body * 0.16);
  rimColor = mix(rimColor, ember, smoothstep(0.58, 1.0, light) * 0.2);
  rimColor += vec3(0.08, 0.55, 0.95) * border * 0.48;
  rimColor *= 0.5 + contour * 0.28 + border * 0.42 + glow * 0.1;
  vec3 color = mix(sourceColor.rgb, rimColor, border * 0.68 + contour * 0.24 + core * 0.08);

  float windowAlpha = body * sourceColor.a;
  float borderAlpha = max(border * 0.82, outerBorder * 0.44 + glow);
  float alpha = max(windowAlpha, borderAlpha) * u_alpha;
  if (alpha <= VISIBLE_ALPHA_THRESHOLD) {
    discard;
  }

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

type PortalMetaballRendererInput = {
  depth: number;
  destinationTextureKey: string;
  screen: { height: number; width: number };
  portal: PortalEntity;
  now: number;
  alpha: number;
};

export class PortalMetaballRenderer {
  private readonly metaballData = new Float32Array(PORTAL_METABALL_COUNT * 4);
  private readonly shader: Phaser.GameObjects.Shader;

  constructor(private readonly scene: Phaser.Scene) {
    this.ensureShaderCached();
    this.shader = scene.add
      .shader(PORTAL_METABALL_SHADER_KEY, 0, 0, 1, 1)
      .setOrigin(0, 0)
      .setDepth(0)
      .setVisible(false);
    markPortalCaptureExcluded(this.shader);
  }

  render({
    alpha,
    depth,
    destinationTextureKey,
    now,
    portal,
    screen,
  }: PortalMetaballRendererInput): void {
    const padding = portal.visualRadiusY * 1.35;
    const bounds = {
      height: portal.visualRadiusY * 2 + padding * 2,
      width: portal.visualRadiusX * 2 + padding * 2,
      x: portal.position.x - portal.visualRadiusX - padding,
      y: portal.position.y - portal.visualRadiusY - padding,
    };

    this.shader
      .setPosition(bounds.x, bounds.y)
      .setSize(bounds.width, bounds.height)
      .setDepth(depth)
      .setUniform('u_alpha.value', alpha)
      .setUniform('u_center.value.x', portal.position.x)
      .setUniform('u_center.value.y', portal.position.y)
      .setUniform('u_normal.value.x', portal.normal.x)
      .setUniform('u_normal.value.y', portal.normal.y)
      .setUniform('u_radius.value.x', portal.visualRadiusX)
      .setUniform('u_radius.value.y', portal.visualRadiusY)
      .setUniform('u_region_origin.value.x', bounds.x)
      .setUniform('u_region_origin.value.y', bounds.y)
      .setUniform('u_screen.value.x', screen.width)
      .setUniform('u_screen.value.y', screen.height)
      .setUniform('u_metaballs.value', buildPortalMetaballData(portal, now, this.metaballData))
      .setUniform('u_time.value', now)
      .setChannel0(destinationTextureKey)
      .setVisible(alpha > 0);
  }

  setVisible(visible: boolean): void {
    this.shader.setVisible(visible);
  }

  destroy(): void {
    this.shader.destroy();
  }

  private ensureShaderCached(): void {
    if (this.scene.cache.shader.has(PORTAL_METABALL_SHADER_KEY)) return;
    this.scene.cache.shader.add(
      PORTAL_METABALL_SHADER_KEY,
      new Phaser.Display.BaseShader(PORTAL_METABALL_SHADER_KEY, fragmentShader, undefined, {
        u_alpha: { type: '1f', value: 1 },
        u_center: { type: '2f', value: { x: 0, y: 0 } },
        u_normal: { type: '2f', value: { x: 1, y: 0 } },
        u_radius: { type: '2f', value: { x: 1, y: 1 } },
        u_region_origin: { type: '2f', value: { x: 0, y: 0 } },
        u_screen: { type: '2f', value: { x: 1, y: 1 } },
        u_metaballs: { type: '4fv', value: new Float32Array(PORTAL_METABALL_COUNT * 4) },
        u_time: { type: '1f', value: 0 },
      }),
    );
  }
}
