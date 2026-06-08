import type Phaser from 'phaser';

import type { Vector } from '../core/types';
import {
  AUDIO_KEY_BUSES,
  DEFAULT_BUS_VOLUMES,
  DEFAULT_MUSIC_TRANSITION,
  SCENE_AUDIO_PROFILES,
} from './audioConfig';
import { resolveAudioEvent } from './AudioEventMap';
import { SceneAudioDirector } from './SceneAudioDirector';
import type {
  AmbienceKey,
  AudioBus,
  AudioEvent,
  AudioKey,
  AudioPlayOptions,
  AudioSceneKey,
  MusicKey,
  MusicTransition,
  WorldAudioOptions,
} from './types';

type SoundWithVolume = Phaser.Sound.BaseSound & {
  setVolume?: (value: number) => Phaser.Sound.BaseSound;
  volume?: number;
};

type ManagedLoop = {
  key: AudioKey;
  sound: Phaser.Sound.BaseSound;
  targetVolume: number;
};

const MANAGERS = new WeakMap<Phaser.Game, AudioManager>();

export function initializeGameAudio(scene: Phaser.Scene): AudioManager {
  const existing = MANAGERS.get(scene.game);
  if (existing) return existing;
  const manager = new AudioManager(scene);
  MANAGERS.set(scene.game, manager);
  return manager;
}

export function getGameAudio(scene: Phaser.Scene): AudioManager {
  return initializeGameAudio(scene);
}

export class AudioManager {
  private readonly busVolumes: Record<AudioBus, number> = { ...DEFAULT_BUS_VOLUMES };
  private readonly cooldowns = new Map<AudioKey, number>();
  private readonly ambience = new Map<AmbienceKey, ManagedLoop>();
  private currentMusic: ManagedLoop | null = null;
  private hostScene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.hostScene = scene;
    scene.game.events.once('destroy', () => this.destroy());
  }

  bindScene(scene: Phaser.Scene): void {
    this.hostScene = scene;
  }

  createSceneDirector(scene: Phaser.Scene, sceneKey: AudioSceneKey): SceneAudioDirector {
    this.bindScene(scene);
    return new SceneAudioDirector(this, scene, sceneKey);
  }

  emit(event: AudioEvent, scene?: Phaser.Scene, listenerPosition?: Vector): void {
    if (scene) this.bindScene(scene);
    for (const cue of resolveAudioEvent(event)) {
      const position = getEventPosition(event);
      if (position && scene) {
        this.playWorldSfx(cue.key, {
          camera: scene.cameras.main,
          listenerPosition,
          cooldownMs: cue.cooldownMs,
          maxDistance: cue.maxDistance,
          position,
          volume: cue.volume,
        });
      } else {
        this.playSfx(cue.key, { cooldownMs: cue.cooldownMs, volume: cue.volume });
      }
    }
  }

  enterScene(sceneKey: AudioSceneKey, scene?: Phaser.Scene): void {
    if (scene) this.bindScene(scene);
    const profile = SCENE_AUDIO_PROFILES[sceneKey];
    this.transitionMusic(profile.music, {
      ...profile.transition,
      volume: profile.musicVolume,
    });
    this.setAmbience(profile.ambience, profile.ambienceVolume ?? 1);
  }

  exitScene(sceneKey: AudioSceneKey): void {
    const profile = SCENE_AUDIO_PROFILES[sceneKey];
    if (profile.ambience) this.setAmbience(profile.ambience, 0, { fadeOutMs: 500 });
  }

  updateScene(sceneKey: AudioSceneKey, snapshot: { riftVisible?: boolean; timeDilation?: boolean }): void {
    if (sceneKey === 'arcade' && snapshot.riftVisible) {
      this.setAmbience(SCENE_AUDIO_PROFILES['rift-space'].ambience, 0.45, { fadeInMs: 350 });
    } else if (sceneKey === 'arcade') {
      this.setAmbience(SCENE_AUDIO_PROFILES['rift-space'].ambience, 0, { fadeOutMs: 500 });
    }
    this.setPlaybackRate(snapshot.timeDilation ? 0.82 : 1);
  }

  transitionMusic(
    key: MusicKey,
    transition: MusicTransition & { volume?: number } = {},
  ): void {
    if (this.currentMusic?.key === key) {
      this.fadeSound(this.currentMusic, this.resolveVolume(key, transition.volume ?? 1), 300);
      return;
    }

    const next = this.createLoop(key, transition.volume ?? 1);
    const fadeInMs = transition.fadeInMs ?? DEFAULT_MUSIC_TRANSITION.fadeInMs;
    const fadeOutMs = transition.fadeOutMs ?? DEFAULT_MUSIC_TRANSITION.fadeOutMs;
    const crossfade = transition.crossfade ?? DEFAULT_MUSIC_TRANSITION.crossfade;
    const previous = this.currentMusic;
    this.currentMusic = next;

    if (next) {
      this.setSoundVolume(next.sound, 0);
      next.sound.play({ loop: true, volume: 0 });
      this.fadeSound(next, next.targetVolume, fadeInMs);
    }
    if (previous) this.fadeOutAndStop(previous, crossfade ? fadeOutMs : 0);
  }

  setAmbience(
    key: AmbienceKey | undefined,
    volume: number,
    transition: MusicTransition = {},
  ): void {
    if (!key) return;
    const existing = this.ambience.get(key);
    const targetVolume = this.resolveVolume(key, volume);
    if (existing) {
      existing.targetVolume = targetVolume;
      this.fadeSound(existing, targetVolume, transition.fadeInMs ?? transition.fadeOutMs ?? 500);
      return;
    }
    const loop = this.createLoop(key, volume);
    if (!loop) return;
    this.ambience.set(key, loop);
    this.setSoundVolume(loop.sound, 0);
    loop.sound.play({ loop: true, volume: 0 });
    this.fadeSound(loop, targetVolume, transition.fadeInMs ?? 700);
  }

  playSfx(key: AudioKey, options: AudioPlayOptions = {}): void {
    if (!this.canPlay(key, options.cooldownMs)) return;
    const volume = this.resolveVolume(key, options.volume ?? 1);
    this.hostScene.sound.play(key, {
      delay: options.delay,
      detune: options.detune,
      loop: options.loop,
      rate: options.rate,
      volume,
    });
  }

  playWorldSfx(key: AudioKey, options: WorldAudioOptions): void {
    const attenuation = getWorldDistanceAttenuation(
      options.position,
      options.camera,
      options.maxDistance ?? 1200,
      options.listenerPosition,
    );
    if (attenuation <= 0) return;
    this.playSfx(key, { ...options, volume: (options.volume ?? 1) * attenuation });
  }

  setBusVolume(bus: AudioBus, volume: number): void {
    this.busVolumes[bus] = clamp01(volume);
    this.refreshLoopVolumes();
  }

  destroy(): void {
    if (this.currentMusic) this.currentMusic.sound.stop();
    for (const loop of this.ambience.values()) loop.sound.stop();
    this.ambience.clear();
    this.currentMusic = null;
  }

  private createLoop(key: AudioKey, volume: number): ManagedLoop | null {
    if (!this.hasAudioAsset(key)) return null;
    const sound = this.hostScene.sound.add(key, { loop: true, volume: 0 });
    return { key, sound, targetVolume: this.resolveVolume(key, volume) };
  }

  private canPlay(key: AudioKey, cooldownMs = 0): boolean {
    if (!this.hasAudioAsset(key)) return false;
    const now = this.hostScene.time.now;
    const readyAt = this.cooldowns.get(key) ?? 0;
    if (now < readyAt) return false;
    if (cooldownMs > 0) this.cooldowns.set(key, now + cooldownMs);
    return true;
  }

  private hasAudioAsset(key: AudioKey): boolean {
    return this.hostScene.cache.audio.exists(key);
  }

  private resolveVolume(key: AudioKey, cueVolume: number): number {
    const bus = AUDIO_KEY_BUSES[key];
    return clamp01(this.busVolumes.master * this.busVolumes[bus] * cueVolume);
  }

  private refreshLoopVolumes(): void {
    if (this.currentMusic) {
      this.setSoundVolume(this.currentMusic.sound, this.resolveVolume(this.currentMusic.key, 1));
    }
    for (const loop of this.ambience.values()) {
      this.setSoundVolume(loop.sound, this.resolveVolume(loop.key, 1));
    }
  }

  private fadeSound(loop: ManagedLoop, volume: number, duration: number): void {
    loop.targetVolume = volume;
    if (duration <= 0) {
      this.setSoundVolume(loop.sound, volume);
      return;
    }
    const state = { volume: this.getSoundVolume(loop.sound) };
    this.hostScene.tweens.add({
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.setSoundVolume(loop.sound, state.volume),
      targets: state,
      volume,
    });
  }

  private fadeOutAndStop(loop: ManagedLoop, duration: number): void {
    if (duration <= 0) {
      loop.sound.stop();
      loop.sound.destroy();
      return;
    }
    const state = { volume: this.getSoundVolume(loop.sound) };
    this.hostScene.tweens.add({
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        loop.sound.stop();
        loop.sound.destroy();
      },
      onUpdate: () => this.setSoundVolume(loop.sound, state.volume),
      targets: state,
      volume: 0,
    });
  }

  private setPlaybackRate(rate: number): void {
    this.hostScene.sound.rate = rate;
  }

  private getSoundVolume(sound: Phaser.Sound.BaseSound): number {
    return (sound as SoundWithVolume).volume ?? 0;
  }

  private setSoundVolume(sound: Phaser.Sound.BaseSound, volume: number): void {
    const soundWithVolume = sound as SoundWithVolume;
    if (soundWithVolume.setVolume) {
      soundWithVolume.setVolume(volume);
    } else {
      soundWithVolume.volume = volume;
    }
  }
}

export function getWorldDistanceAttenuation(
  position: Vector,
  camera: Phaser.Cameras.Scene2D.Camera,
  maxDistance: number,
  listenerPosition?: Vector,
): number {
  const center = listenerPosition ?? {
    x: camera.worldView.x + camera.worldView.width * 0.5,
    y: camera.worldView.y + camera.worldView.height * 0.5,
  };
  const distance = Math.hypot(position.x - center.x, position.y - center.y);
  return clamp01(1 - distance / Math.max(1, maxDistance));
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function getEventPosition(event: AudioEvent): Vector | undefined {
  if ('position' in event) return event.position;
  return undefined;
}
