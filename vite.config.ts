import fs from 'fs/promises';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function createEditorSavePlugin(): Plugin {
  return {
    name: 'editor-save-level',
    configureServer(server) {
      server.middlewares.use('/__editor/save-level', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Uint8Array[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }

          const rawBody = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(rawBody) as {
            createBackup?: boolean;
            fileName?: string;
            level?: unknown;
            materialPlacements?: unknown;
          };

          if (!payload.fileName || typeof payload.fileName !== 'string') {
            throw new Error('Missing fileName');
          }
          if (!payload.fileName.endsWith('.json') || path.basename(payload.fileName) !== payload.fileName) {
            throw new Error('Invalid level file name');
          }
          if (!payload.level || typeof payload.level !== 'object') {
            throw new Error('Missing level payload');
          }

          const levelsDir = path.resolve(server.config.root, 'src/assets/levels');
          const targetFilePath = path.resolve(levelsDir, payload.fileName);

          if (!targetFilePath.startsWith(levelsDir + path.sep)) {
            throw new Error('Resolved path is outside levels directory');
          }

          let backupFileName: string | null = null;
          if (payload.createBackup !== false) {
            const backupsDir = path.resolve(levelsDir, 'backups');
            const existingContent = await fs.readFile(targetFilePath, 'utf8');
            await fs.mkdir(backupsDir, { recursive: true });

            const parsedTarget = path.parse(payload.fileName);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            backupFileName = `${parsedTarget.name}.${timestamp}${parsedTarget.ext}`;
            const backupFilePath = path.resolve(backupsDir, backupFileName);
            await fs.writeFile(backupFilePath, existingContent, 'utf8');
          }

          const levelToSave = { ...(payload.level as Record<string, unknown>) };
          delete levelToSave.tilesets;
          const materialPlacements =
            payload.materialPlacements &&
            typeof payload.materialPlacements === 'object' &&
            !Array.isArray(payload.materialPlacements)
              ? payload.materialPlacements
              : {};
          levelToSave.editor = {
            ...((levelToSave.editor as Record<string, unknown> | undefined) ?? {}),
            materialPlacements,
          };
          await fs.writeFile(targetFilePath, `${JSON.stringify(levelToSave, null, 2)}\n`, 'utf8');

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              backupFileName,
              fileName: payload.fileName,
              ok: true,
            }),
          );
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to save level',
            }),
          );
        }
      });
      server.middlewares.use('/__editor/save-tileset', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Uint8Array[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }

          const rawBody = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(rawBody) as {
            fileName?: string;
            tileset?: unknown;
          };

          if (!payload.fileName || typeof payload.fileName !== 'string') {
            throw new Error('Missing fileName');
          }
          if (
            !payload.fileName.endsWith('.tileset.json') ||
            path.basename(payload.fileName) !== payload.fileName
          ) {
            throw new Error('Invalid tileset file name');
          }
          if (!payload.tileset || typeof payload.tileset !== 'object') {
            throw new Error('Missing tileset payload');
          }

          const tilesDir = path.resolve(server.config.root, 'src/assets/tiles');
          const targetFilePath = path.resolve(tilesDir, payload.fileName);
          if (!targetFilePath.startsWith(tilesDir + path.sep)) {
            throw new Error('Resolved path is outside tiles directory');
          }

          await fs.writeFile(
            targetFilePath,
            `${JSON.stringify(payload.tileset, null, 2)}\n`,
            'utf8',
          );

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ fileName: payload.fileName, ok: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to save tileset',
            }),
          );
        }
      });
      server.middlewares.use('/__editor/save-image', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Uint8Array[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }

          const rawBody = Buffer.concat(chunks).toString('utf8');
          const payload = JSON.parse(rawBody) as {
            assetPath?: string;
            pngDataUrl?: string;
          };

          if (!payload.assetPath || typeof payload.assetPath !== 'string') {
            throw new Error('Missing assetPath');
          }
          if (!payload.assetPath.endsWith('.png')) {
            throw new Error('Only PNG assets can be saved');
          }
          if (!payload.pngDataUrl || typeof payload.pngDataUrl !== 'string') {
            throw new Error('Missing pngDataUrl');
          }

          const match = payload.pngDataUrl.match(/^data:image\/png;base64,(.+)$/);
          if (!match) {
            throw new Error('Invalid PNG data payload');
          }

          const assetsDir = path.resolve(server.config.root, 'src/assets');
          const targetFilePath = path.resolve(assetsDir, payload.assetPath);
          if (!targetFilePath.startsWith(assetsDir + path.sep)) {
            throw new Error('Resolved path is outside assets directory');
          }

          await fs.writeFile(targetFilePath, Buffer.from(match[1], 'base64'));

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ assetPath: payload.assetPath, ok: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Failed to save image',
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), createEditorSavePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 9001,
  },
  build: {
    outDir: 'devBundle',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        editor: path.resolve(__dirname, 'editor.html'),
        spritesheetEditor: path.resolve(__dirname, 'spritesheet-editor.html'),
        spriteEditor: path.resolve(__dirname, 'sprite-editor.html'),
        game: path.resolve(__dirname, 'game.html'),
      },
    },
  },
});
