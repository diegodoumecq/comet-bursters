import Phaser from 'phaser';

import { preloadAudioAssets } from '../../audio/audioLoader';
import { initializeGameAudio } from '../../audio/AudioManager';
import {
  clearGeneratedAssetCache,
  getGeneratedAssetCacheStats,
  pruneGeneratedAssetCache,
  type GeneratedAssetCacheStats,
} from '../../core/generatedAssetCache';
import type { GeneratedTextureGroupProgress } from '../../core/generatedTextureRegistry';
import {
  getAllGeneratedTextureCacheEntries,
  getGeneratedTextureRuntimeStats,
  type GeneratedTextureRuntimeStats,
} from '../generatedTextureScopes';
import { ensureBootGeneratedTextures } from './generatedTextures';

const PROGRESS_BAR_WIDTH = 420;
const PROGRESS_BAR_HEIGHT = 10;

export class BootScene extends Phaser.Scene {
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('boot');
  }

  preload(): void {
    preloadAudioAssets(this);
  }

  async create(): Promise<void> {
    initializeGameAudio(this);
    this.createLoadingView();
    this.installGeneratedAssetDebugApi();
    if (shouldClearGeneratedAssetCache()) {
      await this.runCacheMaintenance('Clearing generated texture cache', () =>
        clearGeneratedAssetCache(),
      );
    }
    await this.runCacheMaintenance('Cleaning stale generated textures', () =>
      pruneGeneratedAssetCache(getAllGeneratedTextureCacheEntries()),
    );
    if (shouldDebugGeneratedAssetCache()) await this.logGeneratedAssetCacheStats('after cleanup');
    await ensureBootGeneratedTextures(this, {
      onGroupComplete: async (progress) => {
        this.updateGeneratedTextureProgress(progress, 'Created');
        await waitForBrowserPaint();
      },
      onGroupStart: async (progress) => {
        this.updateGeneratedTextureProgress(progress, 'Creating');
        await waitForBrowserPaint();
      },
    });
    if (shouldDebugGeneratedAssetCache()) await this.logGeneratedAssetCacheStats('after boot');
    this.statusLabel.setText('Created generated textures');
    this.progressLabel.setText('Ready');
    this.progressFill.setSize(PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT);
    await waitForBrowserPaint();
    this.scene.start('scene-menu');
  }

  private createLoadingView(): void {
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;
    this.add
      .text(centerX, centerY - 84, 'Preparing generated textures', {
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '28px',
      })
      .setOrigin(0.5);

    this.statusLabel = this.add
      .text(centerX, centerY - 22, 'Starting texture registry', {
        color: '#bae6fd',
        fontFamily: 'monospace',
        fontSize: '18px',
      })
      .setOrigin(0.5);

    const barX = centerX - PROGRESS_BAR_WIDTH * 0.5;
    const barY = centerY + 24;
    this.add
      .rectangle(barX, barY, PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT, 0x162033)
      .setOrigin(0, 0.5);
    this.progressFill = this.add
      .rectangle(barX, barY, 1, PROGRESS_BAR_HEIGHT, 0x67e8f9)
      .setOrigin(0, 0.5);
    this.progressFill.setSize(0, PROGRESS_BAR_HEIGHT);

    this.progressLabel = this.add
      .text(centerX, centerY + 58, '0 / 0', {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '14px',
      })
      .setOrigin(0.5);
  }

  private updateGeneratedTextureProgress(
    progress: GeneratedTextureGroupProgress,
    action: 'Created' | 'Creating',
  ): void {
    const completed = action === 'Created' ? progress.index + 1 : progress.index;
    this.statusLabel.setText(`${action} ${progress.group.label}`);
    this.progressLabel.setText(`${completed} / ${progress.total}`);
    this.progressFill.setSize(
      PROGRESS_BAR_WIDTH * (completed / Math.max(1, progress.total)),
      PROGRESS_BAR_HEIGHT,
    );
  }

  private async runCacheMaintenance(label: string, task: () => Promise<void>): Promise<void> {
    this.statusLabel.setText(label);
    this.progressLabel.setText('Cache maintenance');
    await waitForBrowserPaint();
    await task();
    await waitForBrowserPaint();
  }

  private installGeneratedAssetDebugApi(): void {
    window.__cometBurstersGeneratedAssets = {
      clear: () => clearGeneratedAssetCache(),
      prune: () => pruneGeneratedAssetCache(getAllGeneratedTextureCacheEntries()),
      runtime: () => getGeneratedTextureRuntimeStats(this),
      stats: () => getGeneratedAssetCacheStats(getAllGeneratedTextureCacheEntries()),
    };
  }

  private async logGeneratedAssetCacheStats(label: string): Promise<void> {
    const stats = await getGeneratedAssetCacheStats(getAllGeneratedTextureCacheEntries());
    console.info('[generated-assets]', label, {
      indexedDb: stats,
      runtime: getGeneratedTextureRuntimeStats(this),
    });
  }
}

function waitForBrowserPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function shouldClearGeneratedAssetCache(): boolean {
  return new URLSearchParams(window.location.search).get('clearGeneratedAssetCache') === 'true';
}

function shouldDebugGeneratedAssetCache(): boolean {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('debugGeneratedAssetCache') === 'true' ||
    params.get('generatedAssetCacheDebug') === 'true'
  );
}

declare global {
  interface Window {
    __cometBurstersGeneratedAssets?: {
      clear: () => Promise<void>;
      prune: () => Promise<void>;
      runtime: () => GeneratedTextureRuntimeStats;
      stats: () => Promise<GeneratedAssetCacheStats>;
    };
  }
}
