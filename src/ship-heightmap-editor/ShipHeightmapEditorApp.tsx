import { useEffect, useMemo, useRef, useState } from 'react';

import {
  PLAYER_HULL_TEXTURE_SIZE,
  samplePlayerHullHeightMap,
  type PlayerHullHeightSample,
} from '../phaser/player/textures';

type Point = {
  x: number;
  y: number;
};

type HoverSample = {
  canvas: Point;
  point: Point;
  sample: PlayerHullHeightSample;
};

type RenderMode = 'alpha' | 'height' | 'lit' | 'material' | 'normal';

const HEIGHTMAP_SCALE = 60;
const NORMAL_SAMPLE_STEP = 1 / 120;
const NORMAL_STRENGTH = 0.46;
const DEFAULT_ZOOM = 3;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const MATERIAL_COLORS: Record<PlayerHullHeightSample['material'], [number, number, number]> = {
  beacon: [252, 244, 178],
  canopy: [86, 198, 232],
  engine: [237, 129, 63],
  hull: [177, 190, 211],
  shadow: [35, 44, 63],
  turretBase: [150, 172, 202],
  wing: [138, 151, 170],
};

const RENDER_MODES: Array<{ key: RenderMode; label: string }> = [
  { key: 'height', label: 'Height' },
  { key: 'material', label: 'Material' },
  { key: 'normal', label: 'Normals' },
  { key: 'lit', label: 'Lit' },
  { key: 'alpha', label: 'Alpha' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mix(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * clamp(amount, 0, 1));
}

function texturePixelToShipPoint(x: number, y: number, textureSize: number): Point {
  return {
    x: (x + 0.5 - textureSize * 0.5) / HEIGHTMAP_SCALE,
    y: (y + 0.5 - textureSize * 0.5) / HEIGHTMAP_SCALE,
  };
}

function sampleNormal(point: Point): { x: number; y: number; z: number } {
  const left = samplePlayerHullHeightMap({ x: point.x - NORMAL_SAMPLE_STEP, y: point.y }).height;
  const right = samplePlayerHullHeightMap({ x: point.x + NORMAL_SAMPLE_STEP, y: point.y }).height;
  const up = samplePlayerHullHeightMap({ x: point.x, y: point.y - NORMAL_SAMPLE_STEP }).height;
  const down = samplePlayerHullHeightMap({ x: point.x, y: point.y + NORMAL_SAMPLE_STEP }).height;
  const sampleDiameter = NORMAL_SAMPLE_STEP * 2;
  const normal = {
    x: ((left - right) / sampleDiameter) * NORMAL_STRENGTH,
    y: ((up - down) / sampleDiameter) * NORMAL_STRENGTH,
    z: 1,
  };
  const length = Math.hypot(normal.x, normal.y, normal.z);
  return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
}

function getLightVector(angleDegrees: number, elevation: number): Point & { z: number } {
  const angle = (angleDegrees / 180) * Math.PI;
  const planar = Math.sqrt(Math.max(0, 1 - elevation * elevation));
  return {
    x: Math.cos(angle) * planar,
    y: Math.sin(angle) * planar,
    z: elevation,
  };
}

function shadeLitSample(
  point: Point,
  sample: PlayerHullHeightSample,
  angleDegrees: number,
  elevation: number,
): [number, number, number] {
  const normal = sampleNormal(point);
  const light = getLightVector(angleDegrees, elevation);
  const facing = Math.max(0, normal.x * light.x + normal.y * light.y + normal.z * light.z);
  const material = MATERIAL_COLORS[sample.material];
  const shade = clamp(0.16 + facing * 0.76 + sample.height * 0.08, 0, 1);
  return [mix(12, material[0], shade), mix(15, material[1], shade), mix(24, material[2], shade)];
}

function getPixelColor(
  mode: RenderMode,
  point: Point,
  sample: PlayerHullHeightSample,
  lightAngle: number,
  lightElevation: number,
): [number, number, number, number] {
  if (sample.alpha <= 0) return [8, 11, 18, 255];

  if (mode === 'alpha') {
    const value = Math.round(sample.alpha * 255);
    return [value, value, value, 255];
  }

  if (mode === 'material') {
    const color = MATERIAL_COLORS[sample.material];
    return [color[0], color[1], color[2], Math.round(sample.alpha * 255)];
  }

  if (mode === 'normal') {
    const normal = sampleNormal(point);
    return [
      Math.round((normal.x * 0.5 + 0.5) * 255),
      Math.round((normal.y * 0.5 + 0.5) * 255),
      Math.round((normal.z * 0.5 + 0.5) * 255),
      Math.round(sample.alpha * 255),
    ];
  }

  if (mode === 'lit') {
    const color = shadeLitSample(point, sample, lightAngle, lightElevation);
    return [color[0], color[1], color[2], Math.round(sample.alpha * 255)];
  }

  const height = Math.round(sample.height * 255);
  return [height, height, height, Math.round(sample.alpha * 255)];
}

function drawHeightmap(
  canvas: HTMLCanvasElement,
  mode: RenderMode,
  textureSize: number,
  lightAngle: number,
  lightElevation: number,
): void {
  canvas.width = textureSize;
  canvas.height = textureSize;
  const context = canvas.getContext('2d');
  if (!context) return;

  const imageData = context.createImageData(textureSize, textureSize);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const point = texturePixelToShipPoint(x, y, textureSize);
      const sample = samplePlayerHullHeightMap(point);
      const color = getPixelColor(mode, point, sample, lightAngle, lightElevation);
      const index = (y * textureSize + x) * 4;
      imageData.data[index] = color[0];
      imageData.data[index + 1] = color[1];
      imageData.data[index + 2] = color[2];
      imageData.data[index + 3] = color[3];
    }
  }
  context.putImageData(imageData, 0, 0);
}

function formatNumber(value: number): string {
  return value.toFixed(3);
}

export function ShipHeightmapEditorApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<RenderMode>('height');
  const [textureSize, setTextureSize] = useState(PLAYER_HULL_TEXTURE_SIZE);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [lightAngle, setLightAngle] = useState(-135);
  const [lightElevation, setLightElevation] = useState(0.42);
  const [hoverSample, setHoverSample] = useState<HoverSample | null>(null);

  const canvasStyle = useMemo(
    () => ({
      height: `${textureSize * zoom}px`,
      imageRendering: 'pixelated' as const,
      width: `${textureSize * zoom}px`,
    }),
    [textureSize, zoom],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawHeightmap(canvas, mode, textureSize, lightAngle, lightElevation);
  }, [lightAngle, lightElevation, mode, textureSize]);

  function centerCanvas(): void {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      left: Math.max(0, (textureSize * zoom - viewport.clientWidth) / 2),
      top: Math.max(0, (textureSize * zoom - viewport.clientHeight) / 2),
    });
  }

  function updateHover(event: React.PointerEvent<HTMLCanvasElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * textureSize);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * textureSize);
    if (x < 0 || y < 0 || x >= textureSize || y >= textureSize) {
      setHoverSample(null);
      return;
    }

    const point = texturePixelToShipPoint(x, y, textureSize);
    setHoverSample({
      canvas: { x, y },
      point,
      sample: samplePlayerHullHeightMap(point),
    });
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
          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100">View</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {RENDER_MODES.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setMode(entry.key)}
                  className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition ${
                    mode === entry.key
                      ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100'
                      : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Texture</h2>
            <label className="mt-3 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Pixels
              <input
                className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                min={120}
                max={480}
                step={24}
                type="number"
                value={textureSize}
                onChange={(event) => setTextureSize(clamp(Number(event.target.value), 120, 480))}
              />
            </label>
            <label className="mt-4 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Zoom
              <input
                className="mt-2 w-full accent-cyan-300"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.5}
                type="range"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={centerCanvas}
              className="mt-4 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
            >
              Center
            </button>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Light Preview</h2>
            <label className="mt-3 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Angle
              <input
                className="mt-2 w-full accent-cyan-300"
                min={-180}
                max={180}
                step={1}
                type="range"
                value={lightAngle}
                onChange={(event) => setLightAngle(Number(event.target.value))}
              />
            </label>
            <label className="mt-4 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Elevation
              <input
                className="mt-2 w-full accent-cyan-300"
                min={0}
                max={1}
                step={0.01}
                type="range"
                value={lightElevation}
                onChange={(event) => setLightElevation(Number(event.target.value))}
              />
            </label>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500">Angle</dt>
              <dd className="text-right text-slate-200">{Math.round(lightAngle)} deg</dd>
              <dt className="text-slate-500">Elevation</dt>
              <dd className="text-right text-slate-200">{formatNumber(lightElevation)}</dd>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Sample</h2>
            {hoverSample ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-slate-500">Pixel</dt>
                <dd className="text-right text-slate-200">
                  {hoverSample.canvas.x}, {hoverSample.canvas.y}
                </dd>
                <dt className="text-slate-500">Point</dt>
                <dd className="text-right text-slate-200">
                  {formatNumber(hoverSample.point.x)}, {formatNumber(hoverSample.point.y)}
                </dd>
                <dt className="text-slate-500">Height</dt>
                <dd className="text-right text-slate-200">
                  {formatNumber(hoverSample.sample.height)}
                </dd>
                <dt className="text-slate-500">Alpha</dt>
                <dd className="text-right text-slate-200">
                  {formatNumber(hoverSample.sample.alpha)}
                </dd>
                <dt className="text-slate-500">Edge</dt>
                <dd className="text-right text-slate-200">
                  {formatNumber(hoverSample.sample.edgeDistance)}
                </dd>
                <dt className="text-slate-500">Material</dt>
                <dd className="text-right text-slate-200">{hoverSample.sample.material}</dd>
              </dl>
            ) : (
              <div className="mt-3 text-sm text-slate-500">No pixel selected</div>
            )}
          </section>
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
                {textureSize} x {textureSize} px
              </div>
            </div>
            <div className="text-sm text-slate-500">{mode}</div>
          </div>

          <div
            ref={viewportRef}
            className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-800 bg-slate-950"
          >
            <div className="flex min-h-full min-w-full items-center justify-center p-10">
              <canvas
                ref={canvasRef}
                className="border border-slate-700 bg-slate-950 shadow-xl shadow-black/30"
                style={canvasStyle}
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
