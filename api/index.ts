import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createApp } from '../src/server/app';
import { createServerlessStore } from '../src/server/store';

const CLIENT_HTML_GZIP_BASE64 = '__SUBLEDGER_CLIENT_HTML_GZIP_BASE64__';

let cachedHtml: string | null = null;
function getClientHtml(): string {
  if (cachedHtml) return cachedHtml;

  if (!CLIENT_HTML_GZIP_BASE64.startsWith('__SUBLEDGER_')) {
    const buf = Buffer.from(CLIENT_HTML_GZIP_BASE64, 'base64');
    cachedHtml = gunzipSync(buf).toString('utf8');
    return cachedHtml;
  }

  const distHtmlPath = path.join(process.cwd(), 'dist', 'client', 'index.html');
  if (fs.existsSync(distHtmlPath)) {
    cachedHtml = fs.readFileSync(distHtmlPath, 'utf8');
    return cachedHtml;
  }

  return '<!doctype html><html><body>SubLedger</body></html>';
}

const app = createApp({
  store: createServerlessStore(),
  getClientHtml,
});

function normalizeVercelRequest(req: Request): Request {
  const url = new URL(req.url, 'http://localhost');
  const rewrittenPath = url.searchParams.get('__path');

  if (rewrittenPath && (url.pathname === '/api' || url.pathname === '/api/index' || url.pathname === '/')) {
    url.pathname = rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`;
    url.searchParams.delete('__path');
    const init: RequestInit & { duplex?: 'half' } = {
      method: req.method,
      headers: req.headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      init.body = req.body;
      init.duplex = 'half';
    }
    return new Request(url.toString(), init);
  }

  return req;
}

const handle = (req: Request): Response | Promise<Response> => app.fetch(normalizeVercelRequest(req));

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
