import Phaser from 'phaser';

type PreloadTask = () => Promise<void> | void;

class PromisePreloadFile extends Phaser.Loader.File {
  constructor(
    loader: Phaser.Loader.LoaderPlugin,
    key: string,
    private readonly task: PreloadTask,
  ) {
    super(loader, {
      key,
      type: 'promise',
      url: () => undefined,
    });
  }

  onProcess(): void {
    this.state = Phaser.Loader.FILE_PROCESSING;
    Promise.resolve()
      .then(() => this.task())
      .then(
        () => this.onProcessComplete(),
        (error) => {
          console.error(`[preload-task] ${this.key} failed`, error);
          this.onProcessError();
        },
      );
  }

  addToCache(): void {
    // The task writes directly to Phaser texture/cache managers as needed.
  }

  hasCacheConflict(): boolean {
    return false;
  }
}

export function preloadTask(scene: Phaser.Scene, key: string, task: PreloadTask): void {
  scene.load.addFile(new PromisePreloadFile(scene.load, key, task));
}
