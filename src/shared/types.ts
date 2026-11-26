export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

export type BillingCycle = 'monthly' | 'annual' | 'quarterly';

export type DiscoverySource =
  | 'gmail'
  | 'outlook'
  | 'plaid'
  | 'csv_import'
  | 'manual';

export type SubscriptionCategory =
  | 'Design'
  | 'Collaboration'
  | 'AI & Dev'
  | 'CRM & Sales'
  | 'Infrastructure'
  | 'Finance & Ops'
  | 'Security'
  | 'Other';

export type SubscriptionStatus = 'active' | 'trial' | 'canceling' | 'canceled';

export interface ChargeRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: CurrencyCode;
  source: DiscoverySource;
  rawDescriptor: string;
  note?: string;
}

export interface Subscription {
  id: string;
  vendor: string;
  normalizedMerchant: string;
  category: SubscriptionCategory;
  billingCycle: BillingCycle;
  currency: CurrencyCode;
  amount: number; // Current billed amount in native currency
  previousAmount: number | null; // Previous billed amount for price-hike tracking
  nextRenewalDate: string; // YYYY-MM-DD
  lastChargedDate: string; // YYYY-MM-DD
  paymentSource: string; // e.g., "Chase Ink ••4821"
  discoverySource: DiscoverySource;
  status: SubscriptionStatus;
  ownerName: string;
  ownerEmail: string;
  department: string;
  seatCount: number | null;
  pricePerSeat: number | null;
  autoRenewNoticeDays: number;
  chargeHistory: ChargeRecord[];
}

export type HikeType =
  | 'stealth_unit_hike'
  | 'tier_creep'
  | 'promo_expiry'
  | 'fx_drift';

export type HikeStatus = 'open' | 'disputing' | 'downgraded' | 'accepted';

export interface PriceHikeAlert {
  id: string;
  subscriptionId: string;
  vendor: string;
  detectedAt: string; // YYYY-MM-DD
  previousAmount: number;
  newAmount: number;
  currency: CurrencyCode;
  percentIncrease: number;
  monthlyImpactUsd: number;
  annualImpactUsd: number;
  hikeType: HikeType;
  evidence: string;
  source: DiscoverySource;
  status: HikeStatus;
}

export type ZombieSeatStatus =
  | 'flagged'
  | 'nudge_sent'
  | 'reclaim_scheduled'
  | 'reclaimed'
  | 'exempt';

export type EmploymentStatus = 'active' | 'offboarded';

export type ActivitySource = 'google_workspace_sso' | 'slack' | 'both';

export interface ZombieSeat {
  id: string;
  subscriptionId: string;
  vendor: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  employmentStatus: EmploymentStatus;
  seatCostMonthlyUsd: number;
  lastSsoLoginAt: string | null; // YYYY-MM-DD
  lastSlackActiveAt: string | null; // YYYY-MM-DD
  lastAppActivityAt: string | null; // YYYY-MM-DD
  daysInactive: number;
  activitySource: ActivitySource;
  status: ZombieSeatStatus;
  reclaimedAt?: string;
}

export type ConnectorId =
  | 'gmail'
  | 'outlook'
  | 'plaid'
  | 'google_workspace'
  | 'slack';

export interface ConnectorState {
  id: ConnectorId;
  name: string;
  category: 'inbox' | 'banking' | 'identity';
  mode: 'read_only';
  connected: boolean;
  accountLabel: string;
  lastSyncedAt: string | null;
  itemsScanned: number;
  findingsCount: number;
  description: string;
}

export type PlanTier = 'free';

export interface WorkspaceSettings {
  companyName: string;
  planTier: PlanTier;
  zombieThresholdDays: number;
  priceHikeThresholdPct: number;
  renewalNoticeWindowDays: number;
  referenceDate: string; // YYYY-MM-DD
}

export interface DiscoveryBatchLog {
  id: string;
  timestamp: string;
  kind:
    | 'inbox_paste'
    | 'csv_import'
    | 'seat_csv_import'
    | 'connector_sync'
    | 'manual_add'
    | 'seat_reclaim';
  summary: string;
  subscriptionsTouched: number;
  hikesDetected: number;
  zombiesFlagged: number;
}

export interface WorkspaceState {
  settings: WorkspaceSettings;
  connectors: ConnectorState[];
  subscriptions: Subscription[];
  priceHikes: PriceHikeAlert[];
  zombieSeats: ZombieSeat[];
  logs: DiscoveryBatchLog[];
  updatedAt: string;
}

export interface ParsedInvoiceResult {
  vendor: string;
  normalizedMerchant: string;
  category: SubscriptionCategory;
  amount: number;
  currency: CurrencyCode;
  billingCycle: BillingCycle;
  chargedDate: string;
  nextRenewalDate: string;
  seatCount: number | null;
  pricePerSeat: number | null;
  paymentSource: string;
  rawSubjectOrLine: string;
  confidence: number;
  explicitHikeNote: string | null;
}

export interface ParsedTransaction {
  date: string;
  rawDescriptor: string;
  normalizedMerchant: string;
  vendor: string;
  category: SubscriptionCategory;
  amount: number;
  currency: CurrencyCode;
  paymentSource: string;
}

export interface WorkspaceMetrics {
  activeSubscriptionCount: number;
  monthlySpendUsd: number;
  annualSpendUsd: number;
  openHikeCount: number;
  annualHikeImpactUsd: number;
  flaggedZombieCount: number;
  offboardedZombieCount: number;
  monthlyZombieWasteUsd: number;
  annualZombieWasteUsd: number;
  reclaimedMonthlySavingsUsd: number;
  reclaimedAnnualSavingsUsd: number;
  upcomingRenewals14dCount: number;
  upcomingRenewals14dUsd: number;
  planPriceMonthlyUsd: number;
  cledaraMonthlyBaselineUsd: number;
  netPaybackMultiple: number;
}
