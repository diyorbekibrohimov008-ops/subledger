import { describe, expect, it } from 'vitest';
import { parseInvoiceEmail } from '../src/shared/engines/inboxParser';
import {
  ingestParsedInvoiceIntoWorkspace,
  ingestTransactionsIntoWorkspace,
  parseBankCsv,
} from '../src/shared/engines/transactionDetector';
import {
  computeWorkspaceMetrics,
  parseSeatActivityCsv,
  reevaluateWorkspaceZombies,
} from '../src/shared/engines/zombieDetector';
import {
  createDemoWorkspaceState,
  createEmptyWorkspaceState,
  REFERENCE_TODAY,
} from '../src/shared/seedData';

describe('Inbox receipt parser', () => {
  it('extracts vendor, amount, cycle, seats, card, and renewal date from raw invoice text', () => {
    const raw = `From: billing@vercel.com
Subject: Your Vercel invoice for November 2026
Date: 2026-11-10
Plan: Vercel Pro — 6 seats ($24.00/seat/mo, new rate)
Invoice Total: $144.00 USD
Billing cycle: Monthly
Payment method: Visa ending in 4821
Next billing date: 2026-12-10`;

    const parsed = parseInvoiceEmail(raw, REFERENCE_TODAY);
    expect(parsed.vendor).toBe('Vercel');
    expect(parsed.normalizedMerchant).toBe('vercel');
    expect(parsed.amount).toBe(144);
    expect(parsed.currency).toBe('USD');
    expect(parsed.billingCycle).toBe('monthly');
    expect(parsed.seatCount).toBe(6);
    expect(parsed.pricePerSeat).toBe(24);
    expect(parsed.chargedDate).toBe('2026-11-10');
    expect(parsed.nextRenewalDate).toBe('2026-12-10');
    expect(parsed.paymentSource).toContain('4821');
    expect(parsed.explicitHikeNote).toBeTruthy();
  });

  it('handles EUR annual invoices and calculates monthly USD normalization', () => {
    const empty = createEmptyWorkspaceState();
    const parsed = parseInvoiceEmail(
      `From: billing@posthog.com
Subject: PostHog Annual Invoice
Date: 2026-11-01
Total Paid: €1,200.00 EUR annually`,
      REFERENCE_TODAY
    );

    expect(parsed.vendor).toBe('PostHog');
    expect(parsed.currency).toBe('EUR');
    expect(parsed.amount).toBe(1200);
    expect(parsed.billingCycle).toBe('annual');

    const { nextState } = ingestParsedInvoiceIntoWorkspace(empty, parsed, 'gmail');
    const metrics = computeWorkspaceMetrics(nextState);
    expect(metrics.activeSubscriptionCount).toBe(1);
    expect(metrics.monthlySpendUsd).toBe(109);
  });
});

describe('Bank/Card CSV recurring & stealth price hike detector', () => {
  it('parses negative bank debits, normalizes descriptors, and catches stealth price hikes', () => {
    const csv = `Date,Description,Amount,Currency,Card
2026-09-08,STRIPE *VERCEL PRO TEAM,-120.00,USD,Chase Ink ••4821
2026-10-08,STRIPE *VERCEL PRO TEAM,-120.00,USD,Chase Ink ••4821
2026-11-08,STRIPE *VERCEL PRO TEAM,-144.00,USD,Chase Ink ••4821
2026-10-12,CANVA* TEAMS 6 SEATS,-72.00,USD,Amex ••1004
2026-11-10,CANVA* TEAMS 6 SEATS,-90.00,USD,Amex ••1004`;

    const txs = parseBankCsv(csv);
    expect(txs).toHaveLength(5);
    expect(txs[0].vendor).toBe('Vercel');

    const empty = createEmptyWorkspaceState();
    const res = ingestTransactionsIntoWorkspace(empty, txs, 'plaid');

    expect(res.subscriptionsAdded).toBe(2);
    expect(res.hikesDetected).toHaveLength(2);

    const vercelHike = res.hikesDetected.find((h) => h.vendor === 'Vercel');
    expect(vercelHike).toBeDefined();
    expect(vercelHike?.previousAmount).toBe(120);
    expect(vercelHike?.newAmount).toBe(144);
    expect(vercelHike?.percentIncrease).toBe(20);
    expect(vercelHike?.annualImpactUsd).toBe(288);
  });

  it('parses EUR and GBP currency symbols in CSV amounts without dropping rows', () => {
    const csv = `Date,Description,Amount
2026-10-01,POSTHOG CLOUD,-€99.00
2026-11-01,FIGMA TEAM,-£45.50`;
    const txs = parseBankCsv(csv);
    expect(txs).toHaveLength(2);
    expect(txs[0].currency).toBe('EUR');
    expect(txs[0].amount).toBe(99);
    expect(txs[1].currency).toBe('GBP');
    expect(txs[1].amount).toBe(45.5);
  });
});

describe('Zombie Seat Detector (30+ days inactive via SSO / Slack)', () => {
  it('flags 30+ day inactive & offboarded seats, reports $0 free plan cost, and adjusts counts dynamically with threshold changes', () => {
    const demo = createDemoWorkspaceState();
    const initialMetrics = computeWorkspaceMetrics(demo);

    expect(demo.settings.planTier).toBe('free');
    expect(initialMetrics.planPriceMonthlyUsd).toBe(0);
    expect(initialMetrics.flaggedZombieCount).toBe(7);
    expect(initialMetrics.offboardedZombieCount).toBe(2);
    expect(initialMetrics.reclaimedMonthlySavingsUsd).toBe(10);

    // Tightening threshold to 60 days leaves only seats inactive >= 60 days or offboarded
    const stricter = reevaluateWorkspaceZombies(demo, 60);
    const stricterMetrics = computeWorkspaceMetrics(stricter);
    expect(stricterMetrics.flaggedZombieCount).toBeLessThan(initialMetrics.flaggedZombieCount);
    expect(stricterMetrics.offboardedZombieCount).toBe(2);
  });

  it('imports seat activity CSV and evaluates inactivity accurately including rows with missing optional cost', () => {
    const demo = createDemoWorkspaceState();
    const csv = `vendor,employeeName,employeeEmail,department,seatCostMonthlyUsd,lastSsoLoginAt,lastSlackActiveAt,employmentStatus
Figma,Alex Mercer,alex@northstar.studio,Design,18,2026-09-01,2026-09-02,active
Slack,Sam Taylor,sam@northstar.studio,Ops,10,2026-11-09,2026-11-10,active
Notion,Pat Kim,pat@northstar.studio,Ops`;

    const seats = parseSeatActivityCsv(csv, demo);
    expect(seats).toHaveLength(3);
    expect(seats[0].daysInactive).toBe(70);
    expect(seats[0].status).toBe('flagged');
    expect(seats[1].daysInactive).toBe(1);
    expect(seats[2].seatCostMonthlyUsd).toBe(15);
  });
});
