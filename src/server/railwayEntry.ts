import { gunzipSync } from 'node:zlib';
import { createApp } from './app';
import { PostgresWorkspaceStore, MemoryWorkspaceStore } from './store';

const CLIENT_HTML_GZIP_BASE64 = '__SUBLEDGER_CLIENT_HTML_GZIP_BASE64__';
declare const Bun: {
  env: Record<string, string | undefined>;
  serve: (opts: { port: number; hostname?: string; fetch: (req: Request) => Response | Promise<Response> }) => unknown;
};

let cachedHtml: string | null = null;
function getClientHtml(): string {
  if (!cachedHtml) {
    const buf = Buffer.from(CLIENT_HTML_GZIP_BASE64, 'base64');
    cachedHtml = gunzipSync(buf).toString('utf8');
  }
  return cachedHtml;
}

const env = typeof Bun !== 'undefined' ? Bun.env : process.env;
const dbUrl = env.DATABASE_URL?.trim();
const store = dbUrl
  ? new PostgresWorkspaceStore(dbUrl)
  : new MemoryWorkspaceStore();

const app = createApp({
  store,
  getClientHtml,
});

const port = Number(env.PORT ?? 3000);
console.log(`[SubLedger] Railway Bun service listening on port ${port}`);

Bun.serve({
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
});
