import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.cwd();
const clientHtmlPath = path.join(root, 'dist', 'client', 'index.html');
const railwayEntryPath = path.join(root, 'src', 'server', 'railwayEntry.ts');
const railwayOutPath = path.join(root, 'dist', 'railway-function.ts');
const vercelEntryPath = path.join(root, 'api', 'index.ts');
const vercelOutPath = path.join(root, 'dist', 'vercel-api.mjs');
const esbuildCli = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

if (!fs.existsSync(clientHtmlPath)) {
  throw new Error(`Missing built client HTML at ${clientHtmlPath}. Run npm run build:client first.`);
}

const html = fs.readFileSync(clientHtmlPath, 'utf8');
const gzippedBase64 = gzipSync(Buffer.from(html, 'utf8'), { level: 9 }).toString('base64');

function injectHtmlPlaceholder(filePath, pinPostgresVersion) {
  let bundled = fs.readFileSync(filePath, 'utf8');
  const placeholderPattern = /(["'])__SUBLEDGER_CLIENT_HTML_GZIP_BASE64__\1/;
  if (!placeholderPattern.test(bundled)) {
    throw new Error(`Expected client HTML placeholder missing from ${filePath}`);
  }
  bundled = bundled.replace(placeholderPattern, () => JSON.stringify(gzippedBase64));
  if (pinPostgresVersion) {
    bundled = bundled.replace(/from\s*["']postgres["']/g, 'from "postgres@3.4.5"');
  }
  fs.writeFileSync(filePath, bundled, 'utf8');
  return bundled;
}

execFileSync(
  process.execPath,
  [
    esbuildCli,
    railwayEntryPath,
    '--bundle',
    '--minify',
    '--format=esm',
    '--platform=node',
    '--target=es2022',
    '--external:postgres',
    '--external:@vercel/blob',
    '--external:node:*',
    `--outfile=${railwayOutPath}`,
  ],
  { stdio: 'inherit' }
);

const railwayBundled = injectHtmlPlaceholder(railwayOutPath, true);
const railwaySizeKb = (Buffer.byteLength(railwayBundled, 'utf8') / 1024).toFixed(1);
console.log(`Built Railway Function bundle: ${railwayOutPath} (${railwaySizeKb} KB)`);

execFileSync(
  process.execPath,
  [
    esbuildCli,
    vercelEntryPath,
    '--bundle',
    '--minify',
    '--format=esm',
    '--platform=node',
    '--target=es2022',
    '--external:node:*',
    `--outfile=${vercelOutPath}`,
  ],
  { stdio: 'inherit' }
);

const vercelBundled = injectHtmlPlaceholder(vercelOutPath, false);
const vercelBytes = Buffer.byteLength(vercelBundled, 'utf8');
const vercelSha1 = crypto.createHash('sha1').update(vercelBundled, 'utf8').digest('hex');
console.log(`Built Vercel API bundle: ${vercelOutPath} (${(vercelBytes / 1024).toFixed(1)} KB, bytes=${vercelBytes}, sha1=${vercelSha1})`);
