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
            fileName?: string;
            level?: unknown;
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
          const backupsDir = path.resolve(levelsDir, 'backups');
          const targetFilePath = path.resolve(levelsDir, payload.fileName);

          if (!targetFilePath.startsWith(levelsDir + path.sep)) {
            throw new Error('Resolved path is outside levels directory');
          }

          const existingContent = await fs.readFile(targetFilePath, 'utf8');
          await fs.mkdir(backupsDir, { recursive: true });

          const parsedTarget = path.parse(payload.fileName);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFileName = `${parsedTarget.name}.${timestamp}${parsedTarget.ext}`;
          const backupFilePath = path.resolve(backupsDir, backupFileName);

          await fs.writeFile(backupFilePath, existingContent, 'utf8');
          await fs.writeFile(targetFilePath, `${JSON.stringify(payload.level, null, 2)}\n`, 'utf8');

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
        game: path.resolve(__dirname, 'game.html'),
      },
    },
  },
});
