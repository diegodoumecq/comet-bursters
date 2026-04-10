import type { Scene } from './scenes/scene';

export type SceneName = 'loading' | 'title' | 'game' | 'sandbox' | 'gameover';

export class SceneManager {
  private scenes: Map<SceneName, Scene> = new Map();
  private currentSceneName: SceneName = 'loading';
  private nextSceneName: SceneName | null = null;
  private initialized = false;

  register(name: SceneName, scene: Scene): void {
    this.scenes.set(name, scene);
  }

  getCurrentScene(): Scene {
    const scene = this.scenes.get(this.currentSceneName);
    if (!scene) {
      throw new Error(`Scene "${this.currentSceneName}" not registered`);
    }
    return scene;
  }

  getCurrentSceneName(): SceneName {
    return this.currentSceneName;
  }

  transitionTo(name: SceneName): void {
    this.nextSceneName = name;
  }

  update(deltaTime: number): void {
    if (!this.initialized) {
      this.getCurrentScene().enter();
      this.initialized = true;
    }

    if (this.nextSceneName) {
      const currentScene = this.getCurrentScene();
      currentScene.exit();

      this.currentSceneName = this.nextSceneName;
      this.nextSceneName = null;

      const newScene = this.getCurrentScene();
      newScene.enter();
    }

    const scene = this.getCurrentScene();
    scene.update(deltaTime);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const scene = this.getCurrentScene();
    scene.draw(ctx);
  }
}

export const sceneManager = new SceneManager();
