import { normalizeCurrency, round2, toAnnualUsd, toMonthlyUsd } from '../currency';
import { matchVendorDescriptor } from '../vendors';
import type {
  BillingCycle,
  ChargeRecord,
  CurrencyCode,
  DiscoverySource,
  HikeType,
  ParsedInvoiceResult,
  ParsedTransaction,
  PriceHikeAlert,
  Subscription,
  WorkspaceState,
} from '../types';
import { computeNextRenewalDate, diffDays } from './dateUtils';

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeDateCell(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  return null;
}

export function parseBankCsv(
  csvText: string,
  defaultSourceLabel = 'Bank CSV Import'
): ParsedTransaction[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const descIdx = headers.findIndex(
    (h) => h.includes('desc') || h.includes('merchant') || h.includes('vendor') || h.includes('name')
  );
  const amountIdx = headers.findIndex((h) => h === 'amount' || h.includes('debit') || h.includes('price'));
  const currencyIdx = headers.findIndex((h) => h.includes('curr'));
  const cardIdx = headers.findIndex((h) => h.includes('card') || h.includes('account') || h.includes('source'));

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    return [];
  }

  const parsed: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const date = normalizeDateCell(cols[dateIdx] ?? '');
    const rawDescriptor = cols[descIdx] ?? '';
    const rawAmountStr = (cols[amountIdx] ?? '').replace(/[$,\s]/g, '');
    const numeric = Number.parseFloat(rawAmountStr);
    if (!date || !rawDescriptor || !Number.isFinite(numeric) || numeric === 0) {
      continue;
    }

    // Bank exports frequently represent debits as negative values
    const amount = round2(Math.abs(numeric));
    const rawCurrCell = currencyIdx >= 0 ? cols[currencyIdx] : undefined;
    const inferredCurrency: CurrencyCode =
      rawCurrCell
        ? normalizeCurrency(rawCurrCell)
        : (cols[amountIdx] ?? '').includes('€')
          ? 'EUR'
          : (cols[amountIdx] ?? '').includes('£')
            ? 'GBP'
            : 'USD';

    const matched = matchVendorDescriptor(rawDescriptor);
    parsed.push({
      date,
      rawDescriptor,
      normalizedMerchant: matched.normalizedMerchant,
      vendor: matched.vendor,
      category: matched.category,
      amount,
      currency: inferredCurrency,
      paymentSource: cardIdx >= 0 && cols[cardIdx] ? cols[cardIdx] : defaultSourceLabel,
    });
  }

  return parsed.sort((a, b) => a.date.localeCompare(b.date));
}

export function inferBillingCycle(dates: string[]): BillingCycle {
  if (dates.length < 2) return 'monthly';
  const sorted = [...dates].sort();
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = diffDays(sorted[i - 1], sorted[i]);
    if (gap > 0) intervals.push(gap);
  }
  if (intervals.length === 0) return 'monthly';
  const avg = intervals.reduce((s, n) => s + n, 0) / intervals.length;
  if (avg >= 320) return 'annual';
  if (avg >= 75) return 'quarterly';
  return 'monthly';
}

export function classifyPriceHike(percentIncrease: number, currencyChanged = false): HikeType {
  if (currencyChanged) return 'fx_drift';
  if (percentIncrease >= 40) return 'promo_expiry';
  if (percentIncrease >= 20) return 'tier_creep';
  return 'stealth_unit_hike';
}

export function detectHikeFromChargePair(params: {
  subscription: Subscription;
  previousCharge: ChargeRecord;
  latestCharge: ChargeRecord;
  thresholdPct: number;
  source: DiscoverySource;
}): PriceHikeAlert | null {
  const { subscription, previousCharge, latestCharge, thresholdPct, source } = params;
  if (latestCharge.amount <= previousCharge.amount || previousCharge.amount <= 0) {
    return null;
  }

  const pct = round2(
    ((latestCharge.amount - previousCharge.amount) / previousCharge.amount) * 100
  );
  if (pct < thresholdPct) return null;

  const prevMonthlyUsd = toMonthlyUsd(
    previousCharge.amount,
    previousCharge.currency,
    subscription.billingCycle
  );
  const nextMonthlyUsd = toMonthlyUsd(
    latestCharge.amount,
    latestCharge.currency,
    subscription.billingCycle
  );
  const monthlyImpactUsd = round2(Math.max(0, nextMonthlyUsd - prevMonthlyUsd));
  const annualImpactUsd = round2(
    Math.max(
      0,
      toAnnualUsd(latestCharge.amount, latestCharge.currency, subscription.billingCycle) -
        toAnnualUsd(previousCharge.amount, previousCharge.currency, subscription.billingCycle)
    )
  );

  return {
    id: `hike-${subscription.normalizedMerchant}-${latestCharge.date}`,
    subscriptionId: subscription.id,
    vendor: subscription.vendor,
    detectedAt: latestCharge.date,
    previousAmount: previousCharge.amount,
    newAmount: latestCharge.amount,
    currency: latestCharge.currency,
    percentIncrease: pct,
    monthlyImpactUsd,
    annualImpactUsd,
    hikeType: classifyPriceHike(pct, previousCharge.currency !== latestCharge.currency),
    evidence: `${latestCharge.date} charge (${latestCharge.amount.toFixed(2)} ${latestCharge.currency}) vs prior ${previousCharge.date} (${previousCharge.amount.toFixed(2)} ${previousCharge.currency}) via ${source.toUpperCase()}`,
    source,
    status: 'open',
  };
}

export function ingestTransactionsIntoWorkspace(
  state: WorkspaceState,
  transactions: ParsedTransaction[],
  source: DiscoverySource
): {
  nextState: WorkspaceState;
  subscriptionsAdded: number;
  subscriptionsUpdated: number;
  hikesDetected: PriceHikeAlert[];
} {
  const nextSubs = state.subscriptions.map((s) => ({
    ...s,
    chargeHistory: [...s.chargeHistory],
  }));
  const nextHikes = [...state.priceHikes];
  const detectedHikes: PriceHikeAlert[] = [];

  const grouped = new Map<string, ParsedTransaction[]>();
  for (const tx of transactions) {
    const list = grouped.get(tx.normalizedMerchant) ?? [];
    list.push(tx);
    grouped.set(tx.normalizedMerchant, list);
  }

  let subscriptionsAdded = 0;
  let subscriptionsUpdated = 0;

  for (const [merchantKey, group] of grouped.entries()) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    let sub = nextSubs.find((s) => s.normalizedMerchant === merchantKey);

    if (!sub) {
      const cycle = inferBillingCycle(sorted.map((t) => t.date));
      const latest = sorted[sorted.length - 1];
      const prior = sorted.length > 1 ? sorted[sorted.length - 2] : null;
      sub = {
        id: `sub-${merchantKey}`,
        vendor: latest.vendor,
        normalizedMerchant: merchantKey,
        category: latest.category,
        billingCycle: cycle,
        currency: latest.currency,
        amount: latest.amount,
        previousAmount: prior ? prior.amount : null,
        nextRenewalDate: computeNextRenewalDate(
          latest.date,
          cycle,
          state.settings.referenceDate
        ),
        lastChargedDate: latest.date,
        paymentSource: latest.paymentSource,
        discoverySource: source,
        status: 'active',
        ownerName: 'Auto-Discovered',
        ownerEmail: 'finance@company.io',
        department: 'Operations',
        seatCount: null,
        pricePerSeat: null,
        autoRenewNoticeDays: cycle === 'annual' ? 30 : 7,
        chargeHistory: sorted.map((t, idx) => ({
          id: `chg-${merchantKey}-${t.date}-${idx}`,
          date: t.date,
          amount: t.amount,
          currency: t.currency,
          source,
          rawDescriptor: t.rawDescriptor,
        })),
      };
      nextSubs.push(sub);
      subscriptionsAdded += 1;

      if (sorted.length >= 2) {
        const len = sub.chargeHistory.length;
        const alert = detectHikeFromChargePair({
          subscription: sub,
          previousCharge: sub.chargeHistory[len - 2],
          latestCharge: sub.chargeHistory[len - 1],
          thresholdPct: state.settings.priceHikeThresholdPct,
          source,
        });
        if (alert && !nextHikes.some((h) => h.id === alert.id)) {
          nextHikes.unshift(alert);
          detectedHikes.push(alert);
        }
      }
    } else {
      let touched = false;
      for (const tx of sorted) {
        const duplicate = sub.chargeHistory.some(
          (c) => c.date === tx.date && Math.abs(c.amount - tx.amount) < 0.01
        );
        if (!duplicate) {
          sub.chargeHistory.push({
            id: `chg-${merchantKey}-${tx.date}-${sub.chargeHistory.length}`,
            date: tx.date,
            amount: tx.amount,
            currency: tx.currency,
            source,
            rawDescriptor: tx.rawDescriptor,
          });
          touched = true;
        }
      }

      if (touched) {
        sub.chargeHistory.sort((a, b) => a.date.localeCompare(b.date));
        const len = sub.chargeHistory.length;
        const latestCharge = sub.chargeHistory[len - 1];
        const prevCharge = len >= 2 ? sub.chargeHistory[len - 2] : null;
        sub.previousAmount = prevCharge ? prevCharge.amount : sub.previousAmount;
        sub.amount = latestCharge.amount;
        sub.currency = latestCharge.currency;
        sub.lastChargedDate = latestCharge.date;
        sub.nextRenewalDate = computeNextRenewalDate(
          latestCharge.date,
          sub.billingCycle,
          state.settings.referenceDate
        );
        subscriptionsUpdated += 1;

        if (prevCharge) {
          const alert = detectHikeFromChargePair({
            subscription: sub,
            previousCharge: prevCharge,
            latestCharge,
            thresholdPct: state.settings.priceHikeThresholdPct,
            source,
          });
          if (alert && !nextHikes.some((h) => h.id === alert.id)) {
            nextHikes.unshift(alert);
            detectedHikes.push(alert);
          }
        }
      }
    }
  }

  return {
    nextState: {
      ...state,
      subscriptions: nextSubs,
      priceHikes: nextHikes,
      updatedAt: new Date().toISOString(),
    },
    subscriptionsAdded,
    subscriptionsUpdated,
    hikesDetected: detectedHikes,
  };
}

export function ingestParsedInvoiceIntoWorkspace(
  state: WorkspaceState,
  invoice: ParsedInvoiceResult,
  source: DiscoverySource
): {
  nextState: WorkspaceState;
  subscription: Subscription;
  hikeDetected: PriceHikeAlert | null;
  created: boolean;
} {
  const nextSubs = state.subscriptions.map((s) => ({
    ...s,
    chargeHistory: [...s.chargeHistory],
  }));
  const nextHikes = [...state.priceHikes];

  let sub = nextSubs.find((s) => s.normalizedMerchant === invoice.normalizedMerchant);
  let created = false;
  let hikeDetected: PriceHikeAlert | null = null;

  const newCharge: ChargeRecord = {
    id: `chg-${invoice.normalizedMerchant}-${invoice.chargedDate}-${Date.now().toString(36)}`,
    date: invoice.chargedDate,
    amount: invoice.amount,
    currency: invoice.currency,
    source,
    rawDescriptor: invoice.rawSubjectOrLine,
    note: invoice.explicitHikeNote ?? undefined,
  };

  if (!sub) {
    created = true;
    sub = {
      id: `sub-${invoice.normalizedMerchant}`,
      vendor: invoice.vendor,
      normalizedMerchant: invoice.normalizedMerchant,
      category: invoice.category,
      billingCycle: invoice.billingCycle,
      currency: invoice.currency,
      amount: invoice.amount,
      previousAmount: null,
      nextRenewalDate: invoice.nextRenewalDate,
      lastChargedDate: invoice.chargedDate,
      paymentSource: invoice.paymentSource,
      discoverySource: source,
      status: 'active',
      ownerName: 'Inbox Auto-Discovery',
      ownerEmail: 'finance@company.io',
      department: 'General',
      seatCount: invoice.seatCount,
      pricePerSeat: invoice.pricePerSeat,
      autoRenewNoticeDays: invoice.billingCycle === 'annual' ? 30 : 7,
      chargeHistory: [newCharge],
    };
    nextSubs.unshift(sub);
  } else {
    const prevAmount = sub.amount;
    const prevCharge = sub.chargeHistory[sub.chargeHistory.length - 1] ?? {
      id: `chg-prev-${sub.id}`,
      date: sub.lastChargedDate,
      amount: prevAmount,
      currency: sub.currency,
      source: sub.discoverySource,
      rawDescriptor: sub.vendor,
    };

    const duplicate = sub.chargeHistory.some(
      (c) => c.date === newCharge.date && Math.abs(c.amount - newCharge.amount) < 0.01
    );
    if (!duplicate) {
      sub.chargeHistory.push(newCharge);
      sub.chargeHistory.sort((a, b) => a.date.localeCompare(b.date));
    }

    sub.previousAmount = prevAmount;
    sub.amount = invoice.amount;
    sub.currency = invoice.currency;
    sub.billingCycle = invoice.billingCycle;
    sub.lastChargedDate = invoice.chargedDate;
    sub.nextRenewalDate = invoice.nextRenewalDate;
    sub.paymentSource = invoice.paymentSource;
    if (invoice.seatCount !== null) sub.seatCount = invoice.seatCount;
    if (invoice.pricePerSeat !== null) sub.pricePerSeat = invoice.pricePerSeat;

    const alert = detectHikeFromChargePair({
      subscription: sub,
      previousCharge: prevCharge,
      latestCharge: newCharge,
      thresholdPct: state.settings.priceHikeThresholdPct,
      source,
    });
    if (alert && !nextHikes.some((h) => h.id === alert.id)) {
      nextHikes.unshift(alert);
      hikeDetected = alert;
    }
  }

  return {
    nextState: {
      ...state,
      subscriptions: nextSubs,
      priceHikes: nextHikes,
      updatedAt: new Date().toISOString(),
    },
    subscription: sub,
    hikeDetected,
    created,
  };
}
