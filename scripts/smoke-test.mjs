import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), '.data');
const existedBefore = fs.existsSync(dataDir);

const child = spawn(process.execPath, ['dist/server.mjs'], {
  env: { ...process.env, PORT: '3456' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

const baseUrl = 'http://127.0.0.1:3456';

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return await res.json();
    } catch {
      // Server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not become healthy. stdout=${stdout} stderr=${stderr}`);
}

try {
  const health = await waitForHealth();
  console.log('1. /api/health:', JSON.stringify(health));

  const htmlRes = await fetch(`${baseUrl}/`);
  const html = await htmlRes.text();
  if (htmlRes.status !== 200 || !html.includes('SubLedger') || !html.includes('id="root"')) {
    throw new Error(`GET / returned unexpected response: status=${htmlRes.status}, len=${html.length}`);
  }
  console.log('2. GET /:', JSON.stringify({ status: htmlRes.status, bytes: html.length, hasRoot: true }));

  const wsRes = await fetch(`${baseUrl}/api/workspace`);
  const ws = await wsRes.json();
  console.log(
    '3. GET /api/workspace:',
    JSON.stringify({
      status: wsRes.status,
      activeSubscriptionCount: ws.metrics.activeSubscriptionCount,
      openHikeCount: ws.metrics.openHikeCount,
      flaggedZombieCount: ws.metrics.flaggedZombieCount,
      reclaimedMonthlySavingsUsd: ws.metrics.reclaimedMonthlySavingsUsd,
    })
  );

  const inboxRes1 = await fetch(`${baseUrl}/api/discover/inbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'gmail',
      rawText: 'From: billing@vercel.com\nSubject: Vercel Invoice\nDate: 2026-10-10\nTotal: $120.00 USD\nMonthly',
    }),
  });
  const inbox1 = await inboxRes1.json();

  const inboxRes2 = await fetch(`${baseUrl}/api/discover/inbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'gmail',
      rawText: 'From: billing@vercel.com\nSubject: Vercel Invoice\nDate: 2026-11-10\nTotal: $144.00 USD\nMonthly',
    }),
  });
  const inbox2 = await inboxRes2.json();
  console.log(
    '4. POST /api/discover/inbox:',
    JSON.stringify({
      firstCreated: inbox1.created,
      secondCreated: inbox2.created,
      hikePercentIncrease: inbox2.hikeDetected?.percentIncrease ?? null,
      openHikeCountAfter: inbox2.metrics.openHikeCount,
    })
  );

  const txRes = await fetch(`${baseUrl}/api/discover/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'plaid',
      csvText:
        'Date,Description,Amount,Currency\n2026-10-05,CLOUDFLARE* PRO PLAN,-20,USD\n2026-11-05,CLOUDFLARE* PRO PLAN,-25,USD',
    }),
  });
  const tx = await txRes.json();
  console.log(
    '5. POST /api/discover/transactions:',
    JSON.stringify({
      status: txRes.status,
      subscriptionsAdded: tx.subscriptionsAdded,
      hikesDetectedCount: tx.hikesDetected?.length ?? 0,
    })
  );

  const flaggedSeat = tx.state.zombieSeats.find((s) => s.status === 'flagged');
  if (!flaggedSeat) {
    throw new Error('Expected at least one flagged zombie seat');
  }
  const bulkRes = await fetch(`${baseUrl}/api/seats/bulk-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seatIds: [flaggedSeat.id],
      status: 'reclaimed',
    }),
  });
  const bulk = await bulkRes.json();
  console.log(
    '6. POST /api/seats/bulk-action:',
    JSON.stringify({
      status: bulkRes.status,
      reclaimedMonthlySavingsUsd: bulk.metrics.reclaimedMonthlySavingsUsd,
      flaggedZombieCountAfter: bulk.metrics.flaggedZombieCount,
    })
  );

  const csvRes = await fetch(`${baseUrl}/api/export/csv`);
  const csvText = await csvRes.text();
  if (csvRes.status !== 200 || !csvText.startsWith('Vendor,Category,Status')) {
    throw new Error(`GET /api/export/csv failed: status=${csvRes.status}`);
  }
  console.log(
    '7. GET /api/export/csv:',
    JSON.stringify({
      status: csvRes.status,
      lines: csvText.trim().split('\n').length,
      hasHeader: true,
    })
  );

  const persisted = fs.existsSync(path.join(dataDir, 'workspace.json'));
  console.log('8. File store persisted (.data/workspace.json):', persisted);
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (!existedBefore && fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
    console.log('9. Cleaned temporary .data created during smoke test');
  }
}
