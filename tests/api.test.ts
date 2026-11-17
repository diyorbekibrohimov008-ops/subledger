import { describe, expect, it } from 'vitest';
import { GET as vercelGet, POST as vercelPost } from '../api/index';
import { createApp } from '../src/server/app';
import { MemoryWorkspaceStore } from '../src/server/store';

function makeTestApp() {
  return createApp({
    store: new MemoryWorkspaceStore(),
  });
}

describe('SubLedger REST API', () => {
  it('serves health and initial seeded workspace metrics', async () => {
    const app = makeTestApp();
    const healthRes = await app.request('/api/health');
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.ok).toBe(true);

    const wsRes = await app.request('/api/workspace');
    expect(wsRes.status).toBe(200);
    const ws = await wsRes.json();
    expect(ws.metrics.activeSubscriptionCount).toBe(12);
    expect(ws.metrics.openHikeCount).toBe(7);
    expect(ws.metrics.flaggedZombieCount).toBe(7);
  });

  it('supports starting empty, ingesting an email receipt, detecting a follow-up hike, and reclaiming zombie seats', async () => {
    const app = makeTestApp();

    // Start empty workspace
    const emptyRes = await app.request('/api/workspace/empty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: 'Acme SMB' }),
    });
    expect(emptyRes.status).toBe(200);
    const emptyData = await emptyRes.json();
    expect(emptyData.metrics.activeSubscriptionCount).toBe(0);

    // First invoice arrives
    const firstInbox = await app.request('/api/discover/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'gmail',
        rawText: `From: billing@vercel.com\nSubject: Vercel Invoice\nDate: 2026-10-10\nTotal: $120.00 USD\nMonthly`,
      }),
    });
    expect(firstInbox.status).toBe(200);
    const firstJson = await firstInbox.json();
    expect(firstJson.created).toBe(true);
    expect(firstJson.hikeDetected).toBeNull();

    // Stealth price hike invoice arrives next month
    const secondInbox = await app.request('/api/discover/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'gmail',
        rawText: `From: billing@vercel.com\nSubject: Vercel Invoice\nDate: 2026-11-10\nTotal: $144.00 USD\nMonthly`,
      }),
    });
    expect(secondInbox.status).toBe(200);
    const secondJson = await secondInbox.json();
    expect(secondJson.created).toBe(false);
    expect(secondJson.hikeDetected).toBeTruthy();
    expect(secondJson.hikeDetected.percentIncrease).toBe(20);
    expect(secondJson.metrics.openHikeCount).toBe(1);

    // Sync Google Workspace SSO connector and reclaim the flagged zombie seat
    const syncRes = await app.request('/api/connectors/google_workspace/sync', {
      method: 'POST',
    });
    expect(syncRes.status).toBe(200);
    const synced = await syncRes.json();
    expect(synced.metrics.flaggedZombieCount).toBeGreaterThanOrEqual(2);

    const targetSeatId = synced.state.zombieSeats[0].id;
    const reclaimRes = await app.request('/api/seats/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatIds: [targetSeatId], status: 'reclaimed' }),
    });
    expect(reclaimRes.status).toBe(200);
    const reclaimed = await reclaimRes.json();
    expect(reclaimed.metrics.reclaimedMonthlySavingsUsd).toBeGreaterThan(0);
  });

  it('exports valid CSV ledger', async () => {
    const app = makeTestApp();
    const csvRes = await app.request('/api/export/csv');
    expect(csvRes.status).toBe(200);
    const text = await csvRes.text();
    expect(text).toContain('Vendor,Category,Status');
    expect(text).toContain('Figma');
  });

  it('discovers recurring subscriptions from bank CSV, updates hikes, switches SMB plan tiers, and serves HTML', async () => {
    const app = createApp({
      store: new MemoryWorkspaceStore(),
      getClientHtml: () => '<!doctype html><html><body>SubLedger</body></html>',
    });

    const htmlRes = await app.request('/');
    expect(htmlRes.status).toBe(200);
    expect(await htmlRes.text()).toContain('SubLedger');

    const csvRes = await app.request('/api/discover/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'plaid',
        csvText: `Date,Description,Amount,Currency\n2026-10-05,CLOUDFLARE* PRO PLAN,-20,USD\n2026-11-05,CLOUDFLARE* PRO PLAN,-25,USD`,
      }),
    });
    expect(csvRes.status).toBe(200);
    const csvData = await csvRes.json();
    expect(csvData.subscriptionsAdded).toBe(1);
    expect(csvData.hikesDetected).toHaveLength(1);

    const hikeId = csvData.hikesDetected[0].id;
    const actionRes = await app.request(`/api/hikes/${hikeId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'downgraded' }),
    });
    expect(actionRes.status).toBe(200);
    const actionData = await actionRes.json();
    expect(actionData.state.priceHikes.find((h: { id: string }) => h.id === hikeId)?.status).toBe('downgraded');

    const planRes = await app.request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planTier: 'starter_9', zombieThresholdDays: 45 }),
    });
    expect(planRes.status).toBe(200);
    const planData = await planRes.json();
    expect(planData.metrics.planPriceMonthlyUsd).toBe(9);
  });

  it('handles Vercel rewritten /api?__path=/api/... GET and POST requests cleanly', async () => {
    await vercelPost(new Request('https://subledger.vercel.app/api?__path=/api/workspace/reset', { method: 'POST' }));

    const healthRes = await vercelGet(new Request('https://subledger.vercel.app/api?__path=/api/health'));
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.ok).toBe(true);

    const postRes = await vercelPost(
      new Request('https://subledger.vercel.app/api?__path=/api/discover/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'gmail',
          rawText: 'From: billing@linear.app\nSubject: Linear Receipt\nDate: 2026-11-01\nTotal: $64.00 USD\nMonthly',
        }),
      })
    );
    expect(postRes.status).toBe(200);
  });
});
