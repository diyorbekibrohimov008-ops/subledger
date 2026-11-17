import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { toAnnualUsd, toMonthlyUsd } from '../shared/currency';
import { computeNextRenewalDate } from '../shared/engines/dateUtils';
import { parseInvoiceEmail } from '../shared/engines/inboxParser';
import {
  detectHikeFromChargePair,
  ingestParsedInvoiceIntoWorkspace,
  ingestTransactionsIntoWorkspace,
  parseBankCsv,
} from '../shared/engines/transactionDetector';
import {
  computeWorkspaceMetrics,
  parseSeatActivityCsv,
  reevaluateWorkspaceZombies,
} from '../shared/engines/zombieDetector';
import {
  CONNECTOR_SYNC_BATCHES,
  createDemoWorkspaceState,
  createEmptyWorkspaceState,
} from '../shared/seedData';
import type {
  BillingCycle,
  ConnectorId,
  CurrencyCode,
  HikeStatus,
  PlanTier,
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
  WorkspaceState,
  ZombieSeatStatus,
} from '../shared/types';
import { matchVendorDescriptor } from '../shared/vendors';
import type { WorkspaceStore } from './store';

export interface AppDependencies {
  store: WorkspaceStore;
  getClientHtml?: () => string;
}

function withLog(
  state: WorkspaceState,
  entry: Omit<WorkspaceState['logs'][number], 'id' | 'timestamp'>
): WorkspaceState {
  const log = {
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  return {
    ...state,
    logs: [log, ...state.logs].slice(0, 40),
    updatedAt: new Date().toISOString(),
  };
}

function respondWorkspace(state: WorkspaceState) {
  return {
    state,
    metrics: computeWorkspaceMetrics(state),
  };
}

export function createApp({ store, getClientHtml }: AppDependencies) {
  const app = new Hono();

  app.use('/api/*', cors());

  app.get('/api/health', async (c) => {
    const state = await store.getState();
    return c.json({
      ok: true,
      service: 'subledger',
      subscriptions: state.subscriptions.length,
      storage: store.getStorageInfo(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/workspace', async (c) => {
    const state = await store.getState();
    return c.json(respondWorkspace(state));
  });

  app.post('/api/workspace/reset', async (c) => {
    const demo = createDemoWorkspaceState();
    const saved = await store.saveState(demo);
    return c.json(respondWorkspace(saved));
  });

  app.post('/api/workspace/empty', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const companyName =
      typeof body?.companyName === 'string' && body.companyName.trim()
        ? body.companyName.trim()
        : 'My Company';
    const empty = createEmptyWorkspaceState(companyName);
    const saved = await store.saveState(empty);
    return c.json(respondWorkspace(saved));
  });

  app.patch('/api/settings', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid settings payload' }, 400);
    }

    const current = await store.getState();
    const nextSettings = {
      ...current.settings,
      companyName:
        typeof body.companyName === 'string' && body.companyName.trim()
          ? body.companyName.trim()
          : current.settings.companyName,
      planTier:
        body.planTier === 'starter_9' || body.planTier === 'growth_19'
          ? (body.planTier as PlanTier)
          : current.settings.planTier,
      zombieThresholdDays:
        typeof body.zombieThresholdDays === 'number' &&
        body.zombieThresholdDays >= 7 &&
        body.zombieThresholdDays <= 180
          ? Math.round(body.zombieThresholdDays)
          : current.settings.zombieThresholdDays,
      priceHikeThresholdPct:
        typeof body.priceHikeThresholdPct === 'number' &&
        body.priceHikeThresholdPct >= 1 &&
        body.priceHikeThresholdPct <= 50
          ? body.priceHikeThresholdPct
          : current.settings.priceHikeThresholdPct,
      renewalNoticeWindowDays:
        typeof body.renewalNoticeWindowDays === 'number' &&
        body.renewalNoticeWindowDays >= 3 &&
        body.renewalNoticeWindowDays <= 90
          ? Math.round(body.renewalNoticeWindowDays)
          : current.settings.renewalNoticeWindowDays,
    };

    const reevaluated = reevaluateWorkspaceZombies(
      { ...current, settings: nextSettings },
      nextSettings.zombieThresholdDays
    );
    const saved = await store.saveState(reevaluated);
    return c.json(respondWorkspace(saved));
  });

  app.post('/api/subscriptions', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.vendor !== 'string' || !body.vendor.trim()) {
      return c.json({ error: 'Vendor name is required' }, 400);
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ error: 'Amount must be greater than zero' }, 400);
    }

    const state = await store.getState();
    const matched = matchVendorDescriptor(body.vendor.trim());
    const cycle: BillingCycle =
      body.billingCycle === 'annual' || body.billingCycle === 'quarterly'
        ? body.billingCycle
        : 'monthly';
    const currency: CurrencyCode =
      body.currency === 'EUR' ||
      body.currency === 'GBP' ||
      body.currency === 'CAD' ||
      body.currency === 'AUD'
        ? body.currency
        : 'USD';

    const lastChargedDate =
      typeof body.lastChargedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.lastChargedDate)
        ? body.lastChargedDate
        : state.settings.referenceDate;
    const nextRenewalDate =
      typeof body.nextRenewalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.nextRenewalDate)
        ? body.nextRenewalDate
        : computeNextRenewalDate(lastChargedDate, cycle, state.settings.referenceDate);

    const seatCount =
      typeof body.seatCount === 'number' && body.seatCount > 0
        ? Math.round(body.seatCount)
        : null;

    const newSub: Subscription = {
      id: `sub-${matched.normalizedMerchant}-${Date.now().toString(36)}`,
      vendor: body.vendor.trim(),
      normalizedMerchant: matched.normalizedMerchant,
      category:
        (body.category as SubscriptionCategory) || matched.category || 'Other',
      billingCycle: cycle,
      currency,
      amount,
      previousAmount:
        typeof body.previousAmount === 'number' && body.previousAmount > 0
          ? body.previousAmount
          : null,
      nextRenewalDate,
      lastChargedDate,
      paymentSource:
        typeof body.paymentSource === 'string' && body.paymentSource.trim()
          ? body.paymentSource.trim()
          : 'Chase Ink ••4821',
      discoverySource: 'manual',
      status: 'active',
      ownerName:
        typeof body.ownerName === 'string' && body.ownerName.trim()
          ? body.ownerName.trim()
          : 'Finance Owner',
      ownerEmail:
        typeof body.ownerEmail === 'string' && body.ownerEmail.trim()
          ? body.ownerEmail.trim()
          : 'finance@company.io',
      department:
        typeof body.department === 'string' && body.department.trim()
          ? body.department.trim()
          : 'Operations',
      seatCount,
      pricePerSeat: seatCount ? Math.round((amount / seatCount) * 100) / 100 : null,
      autoRenewNoticeDays: cycle === 'annual' ? 30 : 7,
      chargeHistory: [
        {
          id: `chg-${Date.now().toString(36)}`,
          date: lastChargedDate,
          amount,
          currency,
          source: 'manual',
          rawDescriptor: body.vendor.trim().toUpperCase(),
        },
      ],
    };

    let nextHikes = [...state.priceHikes];
    if (newSub.previousAmount && newSub.amount > newSub.previousAmount) {
      const alert = detectHikeFromChargePair({
        subscription: newSub,
        previousCharge: {
          id: 'prev',
          date: lastChargedDate,
          amount: newSub.previousAmount,
          currency,
          source: 'manual',
          rawDescriptor: newSub.vendor,
        },
        latestCharge: newSub.chargeHistory[0],
        thresholdPct: state.settings.priceHikeThresholdPct,
        source: 'manual',
      });
      if (alert) nextHikes = [alert, ...nextHikes];
    }

    const nextState = withLog(
      {
        ...state,
        subscriptions: [newSub, ...state.subscriptions],
        priceHikes: nextHikes,
      },
      {
        kind: 'manual_add',
        summary: `Added ${newSub.vendor} (${newSub.currency} ${newSub.amount}/${newSub.billingCycle}).`,
        subscriptionsTouched: 1,
        hikesDetected: nextHikes.length - state.priceHikes.length,
        zombiesFlagged: 0,
      }
    );

    const saved = await store.saveState(nextState);
    return c.json(respondWorkspace(saved), 201);
  });

  app.patch('/api/subscriptions/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid update payload' }, 400);
    }

    const state = await store.getState();
    const idx = state.subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    const existing = state.subscriptions[idx];
    const updated: Subscription = {
      ...existing,
      status:
        body.status === 'active' ||
        body.status === 'trial' ||
        body.status === 'canceling' ||
        body.status === 'canceled'
          ? (body.status as SubscriptionStatus)
          : existing.status,
      amount:
        typeof body.amount === 'number' && body.amount > 0
          ? body.amount
          : existing.amount,
      billingCycle:
        body.billingCycle === 'monthly' ||
        body.billingCycle === 'annual' ||
        body.billingCycle === 'quarterly'
          ? (body.billingCycle as BillingCycle)
          : existing.billingCycle,
      ownerName:
        typeof body.ownerName === 'string' && body.ownerName.trim()
          ? body.ownerName.trim()
          : existing.ownerName,
      department:
        typeof body.department === 'string' && body.department.trim()
          ? body.department.trim()
          : existing.department,
      seatCount:
        typeof body.seatCount === 'number' && body.seatCount >= 0
          ? body.seatCount
          : existing.seatCount,
    };

    const nextSubs = [...state.subscriptions];
    nextSubs[idx] = updated;
    const saved = await store.saveState({
      ...state,
      subscriptions: nextSubs,
      updatedAt: new Date().toISOString(),
    });
    return c.json(respondWorkspace(saved));
  });

  app.delete('/api/subscriptions/:id', async (c) => {
    const id = c.req.param('id');
    const state = await store.getState();
    if (!state.subscriptions.some((s) => s.id === id)) {
      return c.json({ error: 'Subscription not found' }, 404);
    }

    const saved = await store.saveState({
      ...state,
      subscriptions: state.subscriptions.filter((s) => s.id !== id),
      priceHikes: state.priceHikes.filter((h) => h.subscriptionId !== id),
      zombieSeats: state.zombieSeats.filter((z) => z.subscriptionId !== id),
      updatedAt: new Date().toISOString(),
    });
    return c.json(respondWorkspace(saved));
  });

  app.post('/api/discover/inbox', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.rawText !== 'string' || !body.rawText.trim()) {
      return c.json({ error: 'Email or invoice text is required' }, 400);
    }

    const source = body.source === 'outlook' ? 'outlook' : 'gmail';
    const state = await store.getState();
    const parsed = parseInvoiceEmail(body.rawText, state.settings.referenceDate);
    const { nextState, subscription, hikeDetected, created } =
      ingestParsedInvoiceIntoWorkspace(state, parsed, source);

    const logged = withLog(nextState, {
      kind: 'inbox_paste',
      summary: `${source === 'outlook' ? 'Outlook' : 'Gmail'} parser ${
        created ? 'discovered' : 'updated'
      } ${subscription.vendor} (${subscription.currency} ${subscription.amount}/${subscription.billingCycle})${
        hikeDetected ? ` and flagged a +${hikeDetected.percentIncrease}% price hike` : ''
      }.`,
      subscriptionsTouched: 1,
      hikesDetected: hikeDetected ? 1 : 0,
      zombiesFlagged: 0,
    });

    const saved = await store.saveState(logged);
    return c.json({
      parsed,
      created,
      hikeDetected,
      ...respondWorkspace(saved),
    });
  });

  app.post('/api/discover/transactions', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.csvText !== 'string' || !body.csvText.trim()) {
      return c.json({ error: 'CSV transaction content is required' }, 400);
    }

    const source = body.source === 'plaid' ? 'plaid' : 'csv_import';
    const state = await store.getState();
    const parsedTxs = parseBankCsv(body.csvText, source === 'plaid' ? 'Plaid Card Feed' : 'Bank CSV');
    if (parsedTxs.length === 0) {
      return c.json(
        {
          error:
            'Could not find valid Date, Description/Vendor, and Amount columns in CSV.',
        },
        400
      );
    }

    const { nextState, subscriptionsAdded, subscriptionsUpdated, hikesDetected } =
      ingestTransactionsIntoWorkspace(state, parsedTxs, source);

    const logged = withLog(nextState, {
      kind: 'csv_import',
      summary: `Scanned ${parsedTxs.length} card/bank rows: ${subscriptionsAdded} new, ${subscriptionsUpdated} updated, ${hikesDetected.length} stealth price hike(s) caught.`,
      subscriptionsTouched: subscriptionsAdded + subscriptionsUpdated,
      hikesDetected: hikesDetected.length,
      zombiesFlagged: 0,
    });

    const saved = await store.saveState(logged);
    return c.json({
      parsedCount: parsedTxs.length,
      subscriptionsAdded,
      subscriptionsUpdated,
      hikesDetected,
      ...respondWorkspace(saved),
    });
  });

  app.post('/api/discover/seats', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.csvText !== 'string' || !body.csvText.trim()) {
      return c.json({ error: 'Seat activity CSV content is required' }, 400);
    }

    const state = await store.getState();
    const imported = parseSeatActivityCsv(body.csvText, state);
    if (imported.length === 0) {
      return c.json(
        { error: 'CSV must include vendor/app and email columns.' },
        400
      );
    }

    const nextSeats = [...state.zombieSeats];
    for (const seat of imported) {
      const idx = nextSeats.findIndex(
        (existing) =>
          existing.vendor.toLowerCase() === seat.vendor.toLowerCase() &&
          existing.employeeEmail.toLowerCase() === seat.employeeEmail.toLowerCase()
      );
      if (idx >= 0) {
        nextSeats[idx] = { ...seat, status: nextSeats[idx].status };
      } else {
        nextSeats.unshift(seat);
      }
    }

    const logged = withLog(
      { ...state, zombieSeats: nextSeats },
      {
        kind: 'seat_csv_import',
        summary: `Imported ${imported.length} identity seat record(s) from CSV.`,
        subscriptionsTouched: 0,
        hikesDetected: 0,
        zombiesFlagged: imported.filter((s) => s.daysInactive >= state.settings.zombieThresholdDays).length,
      }
    );

    const saved = await store.saveState(logged);
    return c.json({
      importedCount: imported.length,
      ...respondWorkspace(saved),
    });
  });

  app.post('/api/connectors/:id/toggle', async (c) => {
    const id = c.req.param('id') as ConnectorId;
    const body = await c.req.json().catch(() => ({}));
    const state = await store.getState();
    const idx = state.connectors.findIndex((conn) => conn.id === id);
    if (idx === -1) {
      return c.json({ error: 'Connector not found' }, 404);
    }

    const existing = state.connectors[idx];
    const nextConnected =
      typeof body?.connected === 'boolean' ? body.connected : !existing.connected;

    const defaultLabels: Record<ConnectorId, string> = {
      gmail: 'finance@company.io (read-only)',
      outlook: 'billing@company.onmicrosoft.com',
      plaid: 'Business Checking & Corporate Visa (Read-Only)',
      google_workspace: 'company.io SSO Directory',
      slack: 'company-hq.slack.com',
    };

    const nextConnectors = [...state.connectors];
    nextConnectors[idx] = {
      ...existing,
      connected: nextConnected,
      accountLabel: nextConnected
        ? typeof body?.accountLabel === 'string' && body.accountLabel.trim()
          ? body.accountLabel.trim()
          : existing.accountLabel === 'Not connected'
            ? defaultLabels[id]
            : existing.accountLabel
        : 'Not connected',
      lastSyncedAt: nextConnected ? new Date().toISOString() : null,
    };

    const saved = await store.saveState({
      ...state,
      connectors: nextConnectors,
      updatedAt: new Date().toISOString(),
    });
    return c.json(respondWorkspace(saved));
  });

  app.post('/api/connectors/:id/sync', async (c) => {
    const id = c.req.param('id') as ConnectorId;
    const state = await store.getState();
    const connIdx = state.connectors.findIndex((conn) => conn.id === id);
    if (connIdx === -1) {
      return c.json({ error: 'Connector not found' }, 404);
    }

    const batch = CONNECTOR_SYNC_BATCHES[id];
    let workingState: WorkspaceState = {
      ...state,
      connectors: state.connectors.map((conn, i) =>
        i === connIdx
          ? {
              ...conn,
              connected: true,
              accountLabel:
                conn.accountLabel === 'Not connected'
                  ? `${id.replace('_', '.')}@company.io`
                  : conn.accountLabel,
              lastSyncedAt: new Date().toISOString(),
              itemsScanned: conn.itemsScanned + 48,
            }
          : conn
      ),
    };

    let subsTouched = 0;
    let hikesFound = 0;
    let zombiesFound = 0;

    if (batch.rawEmail) {
      const parsed = parseInvoiceEmail(batch.rawEmail, workingState.settings.referenceDate);
      const res = ingestParsedInvoiceIntoWorkspace(
        workingState,
        parsed,
        id === 'outlook' ? 'outlook' : 'gmail'
      );
      workingState = res.nextState;
      subsTouched += 1;
      if (res.hikeDetected) hikesFound += 1;
    }

    if (batch.csvTransactions) {
      const txs = parseBankCsv(batch.csvTransactions, 'Plaid Read-Only Feed');
      const res = ingestTransactionsIntoWorkspace(workingState, txs, 'plaid');
      workingState = res.nextState;
      subsTouched += res.subscriptionsAdded + res.subscriptionsUpdated;
      hikesFound += res.hikesDetected.length;
    }

    if (batch.seatCsv) {
      const seats = parseSeatActivityCsv(batch.seatCsv, workingState);
      const nextSeats = [...workingState.zombieSeats];
      for (const seat of seats) {
        const existsIdx = nextSeats.findIndex(
          (s) =>
            s.vendor.toLowerCase() === seat.vendor.toLowerCase() &&
            s.employeeEmail.toLowerCase() === seat.employeeEmail.toLowerCase()
        );
        if (existsIdx === -1) {
          nextSeats.unshift(seat);
          zombiesFound += 1;
        }
      }
      workingState = { ...workingState, zombieSeats: nextSeats };
    }

    workingState.connectors = workingState.connectors.map((conn, i) =>
      i === connIdx
        ? {
            ...conn,
            findingsCount: conn.findingsCount + subsTouched + hikesFound + zombiesFound,
          }
        : conn
    );

    const logged = withLog(workingState, {
      kind: 'connector_sync',
      summary: batch.summary,
      subscriptionsTouched: subsTouched,
      hikesDetected: hikesFound,
      zombiesFlagged: zombiesFound,
    });

    const saved = await store.saveState(logged);
    return c.json(respondWorkspace(saved));
  });

  app.post('/api/hikes/:id/action', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const status = body?.status as HikeStatus;
    if (
      status !== 'open' &&
      status !== 'disputing' &&
      status !== 'downgraded' &&
      status !== 'accepted'
    ) {
      return c.json({ error: 'Invalid hike status' }, 400);
    }

    const state = await store.getState();
    const idx = state.priceHikes.findIndex((h) => h.id === id);
    if (idx === -1) {
      return c.json({ error: 'Price hike alert not found' }, 404);
    }

    const nextHikes = [...state.priceHikes];
    nextHikes[idx] = { ...nextHikes[idx], status };

    const saved = await store.saveState({
      ...state,
      priceHikes: nextHikes,
      updatedAt: new Date().toISOString(),
    });
    return c.json(respondWorkspace(saved));
  });

  app.post('/api/seats/bulk-action', async (c) => {
    const body = await c.req.json().catch(() => null);
    const seatIds = Array.isArray(body?.seatIds) ? (body.seatIds as string[]) : [];
    const status = body?.status as ZombieSeatStatus;

    if (
      seatIds.length === 0 ||
      (status !== 'flagged' &&
        status !== 'nudge_sent' &&
        status !== 'reclaim_scheduled' &&
        status !== 'reclaimed' &&
        status !== 'exempt')
    ) {
      return c.json({ error: 'seatIds and valid status are required' }, 400);
    }

    const state = await store.getState();
    const idSet = new Set(seatIds);
    let touchedCount = 0;
    let monthlyFreed = 0;

    const nextSeats = state.zombieSeats.map((seat) => {
      if (!idSet.has(seat.id)) return seat;
      touchedCount += 1;
      if (status === 'reclaimed' && seat.status !== 'reclaimed') {
        monthlyFreed += seat.seatCostMonthlyUsd;
      }
      return {
        ...seat,
        status,
        reclaimedAt: status === 'reclaimed' ? state.settings.referenceDate : seat.reclaimedAt,
      };
    });

    if (touchedCount === 0) {
      return c.json({ error: 'No matching seats found' }, 404);
    }

    const nextState =
      status === 'reclaimed'
        ? withLog(
            { ...state, zombieSeats: nextSeats },
            {
              kind: 'seat_reclaim',
              summary: `Reclaimed ${touchedCount} zombie seat(s), saving $${monthlyFreed.toFixed(2)}/mo ($${(monthlyFreed * 12).toFixed(0)}/yr).`,
              subscriptionsTouched: 0,
              hikesDetected: 0,
              zombiesFlagged: 0,
            }
          )
        : {
            ...state,
            zombieSeats: nextSeats,
            updatedAt: new Date().toISOString(),
          };

    const saved = await store.saveState(nextState);
    return c.json(respondWorkspace(saved));
  });

  app.get('/api/export/csv', async (c) => {
    const state = await store.getState();
    const headers = [
      'Vendor',
      'Category',
      'Status',
      'Billing Cycle',
      'Amount',
      'Currency',
      'Monthly USD',
      'Annual USD',
      'Next Renewal',
      'Payment Source',
      'Discovery Source',
      'Owner',
      'Department',
    ];
    const rows = state.subscriptions.map((s) =>
      [
        s.vendor,
        s.category,
        s.status,
        s.billingCycle,
        s.amount.toFixed(2),
        s.currency,
        toMonthlyUsd(s.amount, s.currency, s.billingCycle).toFixed(2),
        toAnnualUsd(s.amount, s.currency, s.billingCycle).toFixed(2),
        s.nextRenewalDate,
        s.paymentSource,
        s.discoverySource,
        s.ownerName,
        s.department,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="subledger-subscriptions.csv"',
      },
    });
  });

  if (getClientHtml) {
    app.get('*', (c) => {
      if (c.req.path.startsWith('/api/')) {
        return c.json({ error: 'Not found' }, 404);
      }
      return c.html(getClientHtml());
    });
  }

  return app;
}
