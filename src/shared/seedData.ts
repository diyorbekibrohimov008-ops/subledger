import type { ConnectorId, WorkspaceState } from './types';
import { evaluateZombieSeat } from './engines/zombieDetector';
import { detectHikeFromChargePair } from './engines/transactionDetector';

export const REFERENCE_TODAY = '2026-11-11';

export function createEmptyWorkspaceState(companyName = 'My Company'): WorkspaceState {
  return {
    settings: {
      companyName,
      planTier: 'free',
      zombieThresholdDays: 30,
      priceHikeThresholdPct: 3,
      renewalNoticeWindowDays: 14,
      referenceDate: REFERENCE_TODAY,
    },
    connectors: [
      {
        id: 'gmail',
        name: 'Gmail (Read-Only)',
        category: 'inbox',
        mode: 'read_only',
        connected: false,
        accountLabel: 'Not connected',
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: 'Scans receipts & renewal emails via gmail.readonly without touching outgoing mail.',
      },
      {
        id: 'outlook',
        name: 'Microsoft Outlook (Read-Only)',
        category: 'inbox',
        mode: 'read_only',
        connected: false,
        accountLabel: 'Not connected',
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: 'Detects SaaS PDFs & billing notices from Microsoft 365 mailboxes.',
      },
      {
        id: 'plaid',
        name: 'Plaid Bank & Card Feed',
        category: 'banking',
        mode: 'read_only',
        connected: false,
        accountLabel: 'Not connected',
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: 'Reads existing corporate cards & checking accounts — zero virtual card switch.',
      },
      {
        id: 'google_workspace',
        name: 'Google Workspace SSO',
        category: 'identity',
        mode: 'read_only',
        connected: false,
        accountLabel: 'Not connected',
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: 'Flags paid SaaS seats with 30+ days since last SSO sign-in or offboarded staff.',
      },
      {
        id: 'slack',
        name: 'Slack Workspace Activity',
        category: 'identity',
        mode: 'read_only',
        connected: false,
        accountLabel: 'Not connected',
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: 'Cross-checks Slack active status & sends 1-click seat check-ins before reclaiming.',
      },
    ],
    subscriptions: [],
    priceHikes: [],
    zombieSeats: [],
    logs: [
      {
        id: 'log-init-empty',
        timestamp: `${REFERENCE_TODAY}T10:00:00Z`,
        kind: 'connector_sync',
        summary: 'Clean workspace created. Connect a read-only feed or paste a receipt/CSV to discover subscriptions automatically.',
        subscriptionsTouched: 0,
        hikesDetected: 0,
        zombiesFlagged: 0,
      },
    ],
    updatedAt: `${REFERENCE_TODAY}T10:00:00Z`,
  };
}

export function createDemoWorkspaceState(): WorkspaceState {
  const subscriptions: WorkspaceState['subscriptions'] = [
    {
      id: 'sub-figma',
      vendor: 'Figma',
      normalizedMerchant: 'figma',
      category: 'Design',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 270,
      previousAmount: 216,
      nextRenewalDate: '2026-11-18',
      lastChargedDate: '2026-10-18',
      paymentSource: 'Chase Ink ••4821',
      discoverySource: 'gmail',
      status: 'active',
      ownerName: 'Maya Lin',
      ownerEmail: 'maya@northstar.studio',
      department: 'Design',
      seatCount: 15,
      pricePerSeat: 18,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-figma-1',
          date: '2026-08-18',
          amount: 216,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'FIGMA.COM *PRO PLAN 15 SEATS',
        },
        {
          id: 'chg-figma-2',
          date: '2026-09-18',
          amount: 216,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'FIGMA.COM *PRO PLAN 15 SEATS',
        },
        {
          id: 'chg-figma-3',
          date: '2026-10-18',
          amount: 270,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'FIGMA.COM *PRO PLAN 15 SEATS (DEV MODE UPSELL)',
          note: 'Stealth +25% seat rate bump without headcount increase',
        },
      ],
    },
    {
      id: 'sub-slack',
      vendor: 'Slack',
      normalizedMerchant: 'slack',
      category: 'Collaboration',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 280,
      previousAmount: 245,
      nextRenewalDate: '2026-11-15',
      lastChargedDate: '2026-10-15',
      paymentSource: 'Amex Business ••1004',
      discoverySource: 'plaid',
      status: 'active',
      ownerName: 'Devon Brooks',
      ownerEmail: 'devon@northstar.studio',
      department: 'Operations',
      seatCount: 28,
      pricePerSeat: 10,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-slack-1',
          date: '2026-08-15',
          amount: 245,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'SLACK TECHNOLOGIES 800-884-8000',
        },
        {
          id: 'chg-slack-2',
          date: '2026-09-15',
          amount: 245,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'SLACK TECHNOLOGIES 800-884-8000',
        },
        {
          id: 'chg-slack-3',
          date: '2026-10-15',
          amount: 280,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'SLACK TECHNOLOGIES PRO TIER',
        },
      ],
    },
    {
      id: 'sub-hubspot',
      vendor: 'HubSpot',
      normalizedMerchant: 'hubspot',
      category: 'CRM & Sales',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 890,
      previousAmount: 650,
      nextRenewalDate: '2026-11-22',
      lastChargedDate: '2026-10-22',
      paymentSource: 'Amex Business ••1004',
      discoverySource: 'gmail',
      status: 'active',
      ownerName: 'Hannah Park',
      ownerEmail: 'hannah@northstar.studio',
      department: 'Revenue',
      seatCount: 10,
      pricePerSeat: 89,
      autoRenewNoticeDays: 30,
      chargeHistory: [
        {
          id: 'chg-hubspot-1',
          date: '2026-09-22',
          amount: 650,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'HUBSPOT INC *STARTER BUNDLE',
        },
        {
          id: 'chg-hubspot-2',
          date: '2026-10-22',
          amount: 890,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'HUBSPOT INC *MARKETING PRO CONTACT TIER',
        },
      ],
    },
    {
      id: 'sub-notion',
      vendor: 'Notion',
      normalizedMerchant: 'notion',
      category: 'Collaboration',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 264,
      previousAmount: 264,
      nextRenewalDate: '2026-11-25',
      lastChargedDate: '2026-10-25',
      paymentSource: 'Chase Ink ••4821',
      discoverySource: 'gmail',
      status: 'active',
      ownerName: 'Devon Brooks',
      ownerEmail: 'devon@northstar.studio',
      department: 'Operations',
      seatCount: 22,
      pricePerSeat: 12,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-notion-1',
          date: '2026-09-25',
          amount: 264,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'NOTION LABS INC SAN FRANCISCO',
        },
        {
          id: 'chg-notion-2',
          date: '2026-10-25',
          amount: 264,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'NOTION LABS INC SAN FRANCISCO',
        },
      ],
    },
    {
      id: 'sub-openai',
      vendor: 'OpenAI',
      normalizedMerchant: 'openai',
      category: 'AI & Dev',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 450,
      previousAmount: 360,
      nextRenewalDate: '2026-11-19',
      lastChargedDate: '2026-10-19',
      paymentSource: 'Mercury Checking ••8812',
      discoverySource: 'plaid',
      status: 'active',
      ownerName: 'Arjun Patel',
      ownerEmail: 'arjun@northstar.studio',
      department: 'Engineering',
      seatCount: 18,
      pricePerSeat: 25,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-openai-1',
          date: '2026-09-19',
          amount: 360,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'OPENAI *CHATGPT TEAM',
        },
        {
          id: 'chg-openai-2',
          date: '2026-10-19',
          amount: 450,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'OPENAI *CHATGPT TEAM + API OVERAGE',
        },
      ],
    },
    {
      id: 'sub-github',
      vendor: 'GitHub',
      normalizedMerchant: 'github',
      category: 'AI & Dev',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 228,
      previousAmount: 228,
      nextRenewalDate: '2026-12-03',
      lastChargedDate: '2026-11-03',
      paymentSource: 'Chase Ink ••4821',
      discoverySource: 'gmail',
      status: 'active',
      ownerName: 'Arjun Patel',
      ownerEmail: 'arjun@northstar.studio',
      department: 'Engineering',
      seatCount: 12,
      pricePerSeat: 19,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-github-1',
          date: '2026-10-03',
          amount: 228,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'GITHUB.COM *TEAM + COPILOT',
        },
        {
          id: 'chg-github-2',
          date: '2026-11-03',
          amount: 228,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'GITHUB.COM *TEAM + COPILOT',
        },
      ],
    },
    {
      id: 'sub-linear',
      vendor: 'Linear',
      normalizedMerchant: 'linear',
      category: 'AI & Dev',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 160,
      previousAmount: 160,
      nextRenewalDate: '2026-12-01',
      lastChargedDate: '2026-11-01',
      paymentSource: 'Chase Ink ••4821',
      discoverySource: 'outlook',
      status: 'active',
      ownerName: 'Arjun Patel',
      ownerEmail: 'arjun@northstar.studio',
      department: 'Engineering',
      seatCount: 16,
      pricePerSeat: 10,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-linear-1',
          date: '2026-10-01',
          amount: 160,
          currency: 'USD',
          source: 'outlook',
          rawDescriptor: 'LINEAR.APP PLUS PLAN',
        },
        {
          id: 'chg-linear-2',
          date: '2026-11-01',
          amount: 160,
          currency: 'USD',
          source: 'outlook',
          rawDescriptor: 'LINEAR.APP PLUS PLAN',
        },
      ],
    },
    {
      id: 'sub-loom',
      vendor: 'Loom',
      normalizedMerchant: 'loom',
      category: 'Collaboration',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 180,
      previousAmount: 150,
      nextRenewalDate: '2026-11-16',
      lastChargedDate: '2026-10-16',
      paymentSource: 'Amex Business ••1004',
      discoverySource: 'plaid',
      status: 'active',
      ownerName: 'Maya Lin',
      ownerEmail: 'maya@northstar.studio',
      department: 'Design',
      seatCount: 12,
      pricePerSeat: 15,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-loom-1',
          date: '2026-09-16',
          amount: 150,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'LOOM.COM *BUSINESS',
        },
        {
          id: 'chg-loom-2',
          date: '2026-10-16',
          amount: 180,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'LOOM.COM *BUSINESS AI ADDON',
        },
      ],
    },
    {
      id: 'sub-adobe',
      vendor: 'Adobe Creative Cloud',
      normalizedMerchant: 'adobe',
      category: 'Design',
      billingCycle: 'annual',
      currency: 'USD',
      amount: 3599.88,
      previousAmount: 2999.88,
      nextRenewalDate: '2026-11-24',
      lastChargedDate: '2025-11-24',
      paymentSource: 'Amex Business ••1004',
      discoverySource: 'gmail',
      status: 'active',
      ownerName: 'Maya Lin',
      ownerEmail: 'maya@northstar.studio',
      department: 'Design',
      seatCount: 5,
      pricePerSeat: 59.99,
      autoRenewNoticeDays: 30,
      chargeHistory: [
        {
          id: 'chg-adobe-1',
          date: '2024-11-24',
          amount: 2999.88,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'ADOBE SYSTEMS INC ANNUAL',
        },
        {
          id: 'chg-adobe-2',
          date: '2025-11-24',
          amount: 3599.88,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: 'ADOBE SYSTEMS INC ANNUAL RENEWAL',
        },
      ],
    },
    {
      id: 'sub-aws',
      vendor: 'AWS',
      normalizedMerchant: 'aws',
      category: 'Infrastructure',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 640,
      previousAmount: 615,
      nextRenewalDate: '2026-12-02',
      lastChargedDate: '2026-11-02',
      paymentSource: 'Mercury Checking ••8812',
      discoverySource: 'plaid',
      status: 'active',
      ownerName: 'Arjun Patel',
      ownerEmail: 'arjun@northstar.studio',
      department: 'Engineering',
      seatCount: null,
      pricePerSeat: null,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-aws-1',
          date: '2026-10-02',
          amount: 615,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'AMAZON WEB SERVICES',
        },
        {
          id: 'chg-aws-2',
          date: '2026-11-02',
          amount: 640,
          currency: 'USD',
          source: 'plaid',
          rawDescriptor: 'AMAZON WEB SERVICES',
        },
      ],
    },
    {
      id: 'sub-1password',
      vendor: '1Password',
      normalizedMerchant: '1password',
      category: 'Security',
      billingCycle: 'monthly',
      currency: 'USD',
      amount: 224,
      previousAmount: 224,
      nextRenewalDate: '2026-11-28',
      lastChargedDate: '2026-10-28',
      paymentSource: 'Chase Ink ••4821',
      discoverySource: 'gmail',
      status: 'active',
      ownerName: 'Devon Brooks',
      ownerEmail: 'devon@northstar.studio',
      department: 'Security',
      seatCount: 28,
      pricePerSeat: 8,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: 'chg-1p-1',
          date: '2026-10-28',
          amount: 224,
          currency: 'USD',
          source: 'gmail',
          rawDescriptor: '1PASSWORD.COM BUSINESS',
        },
      ],
    },
    {
      id: 'sub-datadog',
      vendor: 'Datadog',
      normalizedMerchant: 'datadog',
      category: 'Infrastructure',
      billingCycle: 'monthly',
      currency: 'EUR',
      amount: 195,
      previousAmount: 195,
      nextRenewalDate: '2026-11-21',
      lastChargedDate: '2026-10-21',
      paymentSource: 'Mercury Checking ••8812',
      discoverySource: 'outlook',
      status: 'active',
      ownerName: 'Arjun Patel',
      ownerEmail: 'arjun@northstar.studio',
      department: 'Engineering',
      seatCount: null,
      pricePerSeat: null,
      autoRenewNoticeDays: 14,
      chargeHistory: [
        {
          id: 'chg-dd-1',
          date: '2026-10-21',
          amount: 195,
          currency: 'EUR',
          source: 'outlook',
          rawDescriptor: 'DATADOG EU CLOUD PRO',
        },
      ],
    },
  ];

  // Auto-derive real PriceHikeAlerts directly from subscription charge histories
  const priceHikes: WorkspaceState['priceHikes'] = [];
  for (const sub of subscriptions) {
    if (sub.chargeHistory.length >= 2) {
      const len = sub.chargeHistory.length;
      const alert = detectHikeFromChargePair({
        subscription: sub,
        previousCharge: sub.chargeHistory[len - 2],
        latestCharge: sub.chargeHistory[len - 1],
        thresholdPct: 3,
        source: sub.discoverySource,
      });
      if (alert) priceHikes.push(alert);
    }
  }

  const rawSeats = [
    {
      id: 'seat-figma-chris',
      subscriptionId: 'sub-figma',
      vendor: 'Figma',
      employeeName: 'Chris Morales',
      employeeEmail: 'chris.m@northstar.studio',
      department: 'Marketing',
      employmentStatus: 'offboarded' as const,
      seatCostMonthlyUsd: 18,
      lastSsoLoginAt: '2026-08-29',
      lastSlackActiveAt: '2026-08-30',
      activitySource: 'both' as const,
      status: 'flagged' as const,
    },
    {
      id: 'seat-hubspot-elena',
      subscriptionId: 'sub-hubspot',
      vendor: 'HubSpot',
      employeeName: 'Elena Vance',
      employeeEmail: 'elena.v@northstar.studio',
      department: 'Sales',
      employmentStatus: 'offboarded' as const,
      seatCostMonthlyUsd: 89,
      lastSsoLoginAt: '2026-09-12',
      lastSlackActiveAt: '2026-09-14',
      activitySource: 'both' as const,
      status: 'flagged' as const,
    },
    {
      id: 'seat-adobe-troy',
      subscriptionId: 'sub-adobe',
      vendor: 'Adobe Creative Cloud',
      employeeName: 'Troy Bennett',
      employeeEmail: 'troy.b@northstar.studio',
      department: 'Brand',
      employmentStatus: 'active' as const,
      seatCostMonthlyUsd: 59.99,
      lastSsoLoginAt: '2026-09-18',
      lastSlackActiveAt: '2026-09-21',
      activitySource: 'google_workspace_sso' as const,
      status: 'flagged' as const,
    },
    {
      id: 'seat-openai-nina',
      subscriptionId: 'sub-openai',
      vendor: 'OpenAI',
      employeeName: 'Nina Kowalski',
      employeeEmail: 'nina.k@northstar.studio',
      department: 'Customer Success',
      employmentStatus: 'active' as const,
      seatCostMonthlyUsd: 25,
      lastSsoLoginAt: '2026-09-24',
      lastSlackActiveAt: '2026-09-27',
      activitySource: 'both' as const,
      status: 'flagged' as const,
    },
    {
      id: 'seat-loom-sam',
      subscriptionId: 'sub-loom',
      vendor: 'Loom',
      employeeName: 'Samir Rao',
      employeeEmail: 'samir.r@northstar.studio',
      department: 'Operations',
      employmentStatus: 'active' as const,
      seatCostMonthlyUsd: 15,
      lastSsoLoginAt: '2026-09-30',
      lastSlackActiveAt: '2026-10-02',
      activitySource: 'slack' as const,
      status: 'flagged' as const,
    },
    {
      id: 'seat-notion-rachel',
      subscriptionId: 'sub-notion',
      vendor: 'Notion',
      employeeName: 'Rachel Kim',
      employeeEmail: 'rachel.k@northstar.studio',
      department: 'Finance',
      employmentStatus: 'active' as const,
      seatCostMonthlyUsd: 12,
      lastSsoLoginAt: '2026-10-03',
      lastSlackActiveAt: '2026-10-05',
      activitySource: 'google_workspace_sso' as const,
      status: 'flagged' as const,
    },
    {
      id: 'seat-github-leo',
      subscriptionId: 'sub-github',
      vendor: 'GitHub',
      employeeName: 'Leo Vance',
      employeeEmail: 'leo.v@northstar.studio',
      department: 'Engineering',
      employmentStatus: 'active' as const,
      seatCostMonthlyUsd: 19,
      lastSsoLoginAt: '2026-09-19',
      lastSlackActiveAt: '2026-09-20',
      activitySource: 'both' as const,
      status: 'nudge_sent' as const,
    },
    {
      id: 'seat-slack-olivia',
      subscriptionId: 'sub-slack',
      vendor: 'Slack',
      employeeName: 'Olivia Grant',
      employeeEmail: 'olivia.g@northstar.studio',
      department: 'Contractors',
      employmentStatus: 'offboarded' as const,
      seatCostMonthlyUsd: 10,
      lastSsoLoginAt: '2026-08-14',
      lastSlackActiveAt: '2026-08-14',
      activitySource: 'slack' as const,
      status: 'reclaimed' as const,
      reclaimedAt: '2026-11-04',
    },
    {
      id: 'seat-figma-maya',
      subscriptionId: 'sub-figma',
      vendor: 'Figma',
      employeeName: 'Maya Lin',
      employeeEmail: 'maya@northstar.studio',
      department: 'Design',
      employmentStatus: 'active' as const,
      seatCostMonthlyUsd: 18,
      lastSsoLoginAt: '2026-11-10',
      lastSlackActiveAt: '2026-11-11',
      activitySource: 'both' as const,
      status: 'exempt' as const,
    },
  ];

  const zombieSeats = rawSeats.map((s) =>
    evaluateZombieSeat(s, 30, REFERENCE_TODAY)
  );

  return {
    settings: {
      companyName: 'Northstar Studio (28 employees)',
      planTier: 'free',
      zombieThresholdDays: 30,
      priceHikeThresholdPct: 3,
      renewalNoticeWindowDays: 14,
      referenceDate: REFERENCE_TODAY,
    },
    connectors: [
      {
        id: 'gmail',
        name: 'Gmail (Read-Only)',
        category: 'inbox',
        mode: 'read_only',
        connected: true,
        accountLabel: 'finance@northstar.studio',
        lastSyncedAt: `${REFERENCE_TODAY}T09:15:00Z`,
        itemsScanned: 1842,
        findingsCount: 6,
        description: 'Reads billing receipts & renewal notices via gmail.readonly scope.',
      },
      {
        id: 'outlook',
        name: 'Microsoft Outlook (Read-Only)',
        category: 'inbox',
        mode: 'read_only',
        connected: true,
        accountLabel: 'ops-billing@northstar.studio',
        lastSyncedAt: `${REFERENCE_TODAY}T09:15:00Z`,
        itemsScanned: 412,
        findingsCount: 2,
        description: 'Parses Microsoft 365 vendor invoices & annual renewal warnings.',
      },
      {
        id: 'plaid',
        name: 'Plaid Bank & Card Feed',
        category: 'banking',
        mode: 'read_only',
        connected: true,
        accountLabel: 'Chase Ink ••4821, Amex ••1004, Mercury ••8812',
        lastSyncedAt: `${REFERENCE_TODAY}T09:12:00Z`,
        itemsScanned: 329,
        findingsCount: 4,
        description: 'Monitors your existing cards & checking accounts with zero virtual-card switch.',
      },
      {
        id: 'google_workspace',
        name: 'Google Workspace SSO',
        category: 'identity',
        mode: 'read_only',
        connected: true,
        accountLabel: 'northstar.studio (28 active, 3 offboarded)',
        lastSyncedAt: `${REFERENCE_TODAY}T08:50:00Z`,
        itemsScanned: 214,
        findingsCount: 5,
        description: 'Checks last SSO app login timestamps to flag 30+ day zombie seats.',
      },
      {
        id: 'slack',
        name: 'Slack Workspace Activity',
        category: 'identity',
        mode: 'read_only',
        connected: true,
        accountLabel: 'northstar-hq.slack.com',
        lastSyncedAt: `${REFERENCE_TODAY}T08:52:00Z`,
        itemsScanned: 168,
        findingsCount: 2,
        description: 'Detects inactive channels/users and sends 1-click check-in nudges.',
      },
    ],
    subscriptions,
    priceHikes,
    zombieSeats,
    logs: [
      {
        id: 'log-1',
        timestamp: `${REFERENCE_TODAY}T09:15:00Z`,
        kind: 'connector_sync',
        summary: `Synced Gmail, Outlook & bank feeds across 3 cards — found ${subscriptions.length} subscriptions and ${priceHikes.length} price increases.`,
        subscriptionsTouched: 12,
        hikesDetected: priceHikes.length,
        zombiesFlagged: 0,
      },
      {
        id: 'log-2',
        timestamp: `${REFERENCE_TODAY}T08:52:00Z`,
        kind: 'connector_sync',
        summary: 'Checked Google Workspace & Slack sign-ins — found 7 seats unused for 30+ days (2 former team members).',
        subscriptionsTouched: 0,
        hikesDetected: 0,
        zombiesFlagged: 7,
      },
    ],
    updatedAt: `${REFERENCE_TODAY}T09:15:00Z`,
  };
}

export const SAMPLE_INBOX_EMAILS: { label: string; rawText: string }[] = [
  {
    label: 'Vercel Pro Price Hike Receipt',
    rawText: `From: billing@vercel.com
Subject: Your Vercel invoice for November 2026
Date: 2026-11-10
Billed to: Northstar Studio (Visa ending in 4821)
Plan: Vercel Pro — 6 team seats ($24.00/seat/mo, new rate)
Invoice Total: $144.00 USD
Billing cycle: Monthly
Next billing date: 2026-12-10`,
  },
  {
    label: 'Sentry Team Annual Renewal Notice',
    rawText: `From: billing@sentry.io
Subject: Sentry Invoice #INV-94821 — Annual Plan
Date: 2026-11-09
Total Paid: $960.00 USD (annual)
Payment method: Amex Business ending in 1004
Seats: 12 users
Next renewal date: 2027-11-09`,
  },
  {
    label: 'Intercom Stealth Seat Increase',
    rawText: `From: invoicing@intercom.io
Subject: Intercom Receipt — Updated Pricing
Date: 2026-11-08
Amount Paid: $395.00 USD (monthly)
Seats: 5 seats
Note: Price update effective this cycle — previously $299.00/mo
Card: Chase Ink ending in 4821`,
  },
];

export const SAMPLE_BANK_CSV = `Date,Description,Amount,Currency,Card
2026-09-05,CLOUDFLARE* PRO PLAN,20.00,USD,Chase Ink ••4821
2026-10-05,CLOUDFLARE* PRO PLAN,20.00,USD,Chase Ink ••4821
2026-11-05,CLOUDFLARE* PRO PLAN,25.00,USD,Chase Ink ••4821
2026-09-08,STRIPE *VERCEL PRO TEAM,120.00,USD,Chase Ink ••4821
2026-10-08,STRIPE *VERCEL PRO TEAM,120.00,USD,Chase Ink ••4821
2026-11-08,STRIPE *VERCEL PRO TEAM,144.00,USD,Chase Ink ••4821
2026-10-12,CANVA* TEAMS 6 SEATS,72.00,USD,Amex Business ••1004
2026-11-10,CANVA* TEAMS 6 SEATS,90.00,USD,Amex Business ••1004
2026-10-14,POSTHOG CLOUD EU,49.00,EUR,Mercury Checking ••8812
2026-11-11,POSTHOG CLOUD EU,49.00,EUR,Mercury Checking ••8812`;

export const SAMPLE_TRACKMYSUBS_CSV = `Date,Vendor,Amount,Currency,Card
2026-10-01,AirTable Team Plan,240.00,USD,Manual TrackMySubs Export
2026-11-01,AirTable Team Plan,288.00,USD,Manual TrackMySubs Export
2026-10-10,DocuSign Business Pro,195.00,USD,Manual TrackMySubs Export
2026-11-10,DocuSign Business Pro,195.00,USD,Manual TrackMySubs Export`;

export const SAMPLE_SEAT_ACTIVITY_CSV = `vendor,employeeName,employeeEmail,department,seatCostMonthlyUsd,lastSsoLoginAt,lastSlackActiveAt,employmentStatus
Canva Teams,Jordan Ellis,jordan.e@northstar.studio,Marketing,15,2026-09-10,2026-09-12,active
Vercel,Kevin Cho,kevin.c@northstar.studio,Engineering,24,2026-08-22,2026-08-25,offboarded
Linear,Priya Nair,priya.n@northstar.studio,Product,10,2026-10-01,2026-10-03,active`;

export const CONNECTOR_SYNC_BATCHES: Record<
  ConnectorId,
  {
    rawEmail?: string;
    csvTransactions?: string;
    seatCsv?: string;
    summary: string;
  }
> = {
  gmail: {
    rawEmail: SAMPLE_INBOX_EMAILS[0].rawText,
    summary: 'Gmail read-only sync parsed a new Vercel Pro invoice ($144.00/mo, $24/seat).',
  },
  outlook: {
    rawEmail: SAMPLE_INBOX_EMAILS[2].rawText,
    summary: 'Outlook read-only sync caught an Intercom pricing update email ($395.00/mo).',
  },
  plaid: {
    csvTransactions: `Date,Description,Amount,Currency,Card
2026-10-05,CLOUDFLARE* PRO PLAN,20.00,USD,Chase Ink ••4821
2026-11-05,CLOUDFLARE* PRO PLAN,25.00,USD,Chase Ink ••4821
2026-10-12,CANVA* TEAMS 6 SEATS,72.00,USD,Amex Business ••1004
2026-11-10,CANVA* TEAMS 6 SEATS,90.00,USD,Amex Business ••1004`,
    summary: 'Plaid card sync pulled new Cloudflare (+25% hike) & Canva Teams (+25% hike) charges.',
  },
  google_workspace: {
    seatCsv: `vendor,employeeName,employeeEmail,department,seatCostMonthlyUsd,lastSsoLoginAt,lastSlackActiveAt,employmentStatus
Vercel,Kevin Cho,kevin.c@northstar.studio,Engineering,24,2026-08-22,,offboarded
Canva Teams,Jordan Ellis,jordan.e@northstar.studio,Marketing,15,2026-09-10,,active`,
    summary: 'Google Workspace SSO flagged Kevin Cho (offboarded, Vercel $24/mo) & Jordan Ellis (62d inactive, Canva $15/mo).',
  },
  slack: {
    seatCsv: `vendor,employeeName,employeeEmail,department,seatCostMonthlyUsd,lastSsoLoginAt,lastSlackActiveAt,employmentStatus
Linear,Priya Nair,priya.n@northstar.studio,Product,10,,2026-10-03,active`,
    summary: 'Slack activity sync flagged Priya Nair (39d inactive on Linear, $10/mo).',
  },
};
