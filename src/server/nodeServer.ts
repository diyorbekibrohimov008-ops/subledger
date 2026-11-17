import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createDefaultStore } from './store';

const port = Number(process.env.PORT ?? 3001);
const distHtmlPath = path.join(process.cwd(), 'dist', 'client', 'index.html');

const app = createApp({
  store: createDefaultStore(),
  getClientHtml: () => {
    if (fs.existsSync(distHtmlPath)) {
      return fs.readFileSync(distHtmlPath, 'utf8');
    }
    return `<!doctype html><html><body><p>Run Vite dev server on :5173 or npm run build:client</p></body></html>`;
  },
});

console.log(`[SubLedger] Node API server listening on http://localhost:${port}`);
serve({
  fetch: app.fetch,
  port,
});
