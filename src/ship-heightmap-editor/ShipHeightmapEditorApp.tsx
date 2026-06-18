import { useEffect, useRef, useState } from 'react';

import {
  PLAYER_HULL_TEXTURE_SIZE,
  rotatePoint,
  samplePlayerHullHeightMap,
  samplePlayerHullHeightNormal,
  shadePlayerHullSample,
  texturePixelToShipPoint,
  type PlayerHullHeightSample,
} from '../phaser/player/textures';
import {
  clonePlayerShipHeightmapConfig,
  PLAYER_SHIP_HEIGHTMAP_CONFIG,
  PLAYER_SHIP_HEIGHTMAP_FILE_NAME,
  type PlayerShipHeightmapConfig,
} from '../phaser/player/shipHeightmapConfig';
import {
  PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS,
  type PlayerShipHeightmapControl,
} from '../phaser/player/shipHeightmapControls';
import { PLAYER_SHIP_MATERIAL_DEBUG_COLORS } from '../phaser/player/shipHeightmapMaterials';
import { HeightmapControlSection } from './sections/HeightmapControlSection';
import { OutputSection } from './sections/OutputSection';
import { PreviewSection } from './sections/PreviewSection';
import { SampleSection } from './sections/SampleSection';
import { ViewSection } from './sections/ViewSection';
import type { HoverSample, Point, RenderMode } from './types';

const PREVIEW_TEXTURE_DISPLAY_SIZE = 720;

function getLightVector(angleDegrees: number, elevation: number): Point & { z: number } {
  const angle = (angleDegrees / 180) * Math.PI;
  const planar = Math.sqrt(Math.max(0, 1 - elevation * elevation));
  return {
    x: Math.cos(angle) * planar,
    y: Math.sin(angle) * planar,
    z: elevation,
  };
}

function getPixelColor(
  mode: RenderMode,
  point: Point,
  sample: PlayerHullHeightSample,
  config: PlayerShipHeightmapConfig,
  lightAngle: number,
  lightElevation: number,
): [number, number, number, number] {
  if (sample.alpha <= 0) return [8, 11, 18, 255];

  if (mode === 'alpha') {
    const value = Math.round(sample.alpha * 255);
    return [value, value, value, 255];
  }

  if (mode === 'material') {
    const color = PLAYER_SHIP_MATERIAL_DEBUG_COLORS[sample.material];
    return [color[0], color[1], color[2], Math.round(sample.alpha * 255)];
  }

  if (mode === 'normal') {
    const normal = samplePlayerHullHeightNormal(point, config);
    return [
      Math.round((normal.x * 0.5 + 0.5) * 255),
      Math.round((normal.y * 0.5 + 0.5) * 255),
      Math.round((normal.z * 0.5 + 0.5) * 255),
      Math.round(sample.alpha * 255),
    ];
  }

  if (mode === 'lit') {
    const light = getLightVector(lightAngle, lightElevation);
    const color = shadePlayerHullSample(point, sample, light, config, light.z);
    return [color.r, color.g, color.b, Math.round(sample.alpha * 255)];
  }

  const height = Math.round(sample.height * 255);
  return [height, height, height, Math.round(sample.alpha * 255)];
}

function drawHeightmap(
  canvas: HTMLCanvasElement,
  mode: RenderMode,
  config: PlayerShipHeightmapConfig,
  textureSize: number,
  shipRotation: number,
  lightAngle: number,
  lightElevation: number,
): void {
  canvas.width = textureSize;
  canvas.height = textureSize;
  const context = canvas.getContext('2d');
  if (!context) return;

  const imageData = context.createImageData(textureSize, textureSize);
  const shipRotationRadians = (-shipRotation / 180) * Math.PI;
  const modelLightAngle = lightAngle - shipRotation;
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const point = rotatePoint(texturePixelToShipPoint(x, y), shipRotationRadians);
      const sample = samplePlayerHullHeightMap(point, config);
      const color = getPixelColor(mode, point, sample, config, modelLightAngle, lightElevation);
      const index = (y * textureSize + x) * 4;
      imageData.data[index] = color[0];
      imageData.data[index + 1] = color[1];
      imageData.data[index + 2] = color[2];
      imageData.data[index + 3] = color[3];
    }
  }
  context.putImageData(imageData, 0, 0);
}

function setConfigNumber(target: Record<string, unknown>, path: readonly string[], value: number): void {
  const [key, ...remainingPath] = path;
  if (!key) return;
  if (remainingPath.length === 0) {
    target[key] = value;
    return;
  }

  const nextTarget = target[key];
  if (!nextTarget || typeof nextTarget !== 'object' || Array.isArray(nextTarget)) return;
  setConfigNumber(nextTarget as Record<string, unknown>, remainingPath, value);
}

export function ShipHeightmapEditorApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<RenderMode>('height');
  const [heightmapConfig, setHeightmapConfig] = useState(() =>
    clonePlayerShipHeightmapConfig(PLAYER_SHIP_HEIGHTMAP_CONFIG),
  );
  const [shipRotation, setShipRotation] = useState(0);
  const [lightAngle, setLightAngle] = useState(-135);
  const [lightElevation, setLightElevation] = useState(0.42);
  const [hoverSample, setHoverSample] = useState<HoverSample | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawHeightmap(
      canvas,
      mode,
      heightmapConfig,
      PLAYER_HULL_TEXTURE_SIZE,
      shipRotation,
      lightAngle,
      lightElevation,
    );
  }, [heightmapConfig, lightAngle, lightElevation, mode, shipRotation]);

  function updateHover(event: React.PointerEvent<HTMLCanvasElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * PLAYER_HULL_TEXTURE_SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * PLAYER_HULL_TEXTURE_SIZE);
    if (x < 0 || y < 0 || x >= PLAYER_HULL_TEXTURE_SIZE || y >= PLAYER_HULL_TEXTURE_SIZE) {
      setHoverSample(null);
      return;
    }

    const point = rotatePoint(
      texturePixelToShipPoint(x, y),
      (-shipRotation / 180) * Math.PI,
    );
    setHoverSample({
      canvas: { x, y },
      point,
      sample: samplePlayerHullHeightMap(point, heightmapConfig),
    });
  }

  function updateHeightmapControl(control: PlayerShipHeightmapControl, value: number): void {
    setHeightmapConfig((current) => {
      const nextConfig = clonePlayerShipHeightmapConfig(current);
      setConfigNumber(nextConfig as unknown as Record<string, unknown>, control.path, value);
      return nextConfig;
    });
    setSaveMessage(null);
  }

  function updateLightAngle(value: number): void {
    setLightAngle(value);
    setMode('lit');
  }

  function updateLightElevation(value: number): void {
    setLightElevation(value);
    setMode('lit');
  }

  async function saveHeightmapConfig(): Promise<void> {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch('/__editor/save-ship-heightmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: heightmapConfig,
          fileName: PLAYER_SHIP_HEIGHTMAP_FILE_NAME,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error ?? 'Failed to save ship heightmap');
      }

      setSaveMessage(`Saved ${PLAYER_SHIP_HEIGHTMAP_FILE_NAME}.`);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save ship heightmap.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid h-screen grid-cols-[320px_minmax(0,1fr)] overflow-hidden bg-slate-950 text-slate-100">
      <aside className="flex min-h-0 flex-col border-r border-slate-800 bg-slate-950/95">
        <div className="border-b border-slate-800 px-6 py-5">
          <a
            href="/"
            className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Back Home
          </a>
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Player Ship
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white">Heightmap Editor</h1>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <ViewSection mode={mode} onModeChange={setMode} />
          <PreviewSection
            lightAngle={lightAngle}
            lightElevation={lightElevation}
            onLightAngleChange={updateLightAngle}
            onLightElevationChange={updateLightElevation}
            onShipRotationChange={setShipRotation}
            shipRotation={shipRotation}
          />
          {PLAYER_SHIP_HEIGHTMAP_CONTROL_SECTIONS.map((section) => (
            <HeightmapControlSection
              key={section.title}
              config={heightmapConfig}
              onControlChange={updateHeightmapControl}
              section={section}
            />
          ))}
          <OutputSection
            isSaving={isSaving}
            onSave={() => void saveHeightmapConfig()}
            saveMessage={saveMessage}
          />
          <SampleSection hoverSample={hoverSample} />
        </div>
      </aside>

      <main className="min-w-0 bg-slate-950 p-8">
        <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/50">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Ship Geometry
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {PLAYER_HULL_TEXTURE_SIZE} x {PLAYER_HULL_TEXTURE_SIZE} px
              </div>
            </div>
            <div className="text-sm text-slate-500">{mode}</div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-950">
            <div className="flex min-h-full min-w-full items-center justify-center p-10">
              <canvas
                ref={canvasRef}
                className="shrink-0 border border-slate-700 bg-slate-950 shadow-xl shadow-black/30"
                style={{
                  height: `${PREVIEW_TEXTURE_DISPLAY_SIZE}px`,
                  imageRendering: 'pixelated',
                  width: `${PREVIEW_TEXTURE_DISPLAY_SIZE}px`,
                }}
                onPointerLeave={() => setHoverSample(null)}
                onPointerMove={updateHover}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
