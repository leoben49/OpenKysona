import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Dev server only: lets the page append results to .devlog/log.jsonl and pick
 * up one-shot tasks dropped into .devlog/task.json.
 */
function devLog(): Plugin {
  return {
    name: 'dev-log',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__task', (_req, res) => {
        const file = '.devlog/task.json';
        if (!existsSync(file)) {
          res.statusCode = 204;
          return res.end();
        }
        const task = readFileSync(file, 'utf8');
        rmSync(file);
        res.setHeader('Content-Type', 'application/json');
        res.end(task);
      });
      server.middlewares.use('/__devlog', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          mkdirSync('.devlog', { recursive: true });
          appendFileSync('.devlog/log.jsonl', body.replace(/\n/g, ' ') + '\n');
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [svelte(), viteSingleFile(), devLog()],
  server: { port: 5173, strictPort: true, host: 'localhost' },
  build: { target: 'es2022' },
});
