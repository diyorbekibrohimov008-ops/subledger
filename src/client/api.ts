import type {
  BillingCycle,
  ConnectorId,
  CurrencyCode,
  HikeStatus,
  ParsedInvoiceResult,
  PriceHikeAlert,
  SubscriptionCategory,
  SubscriptionStatus,
  WorkspaceMetrics,
  WorkspaceSettings,
  WorkspaceState,
  ZombieSeatStatus,
} from '../shared/types';

export interface WorkspacePayload {
  state: WorkspaceState;
  metrics: WorkspaceMetrics;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`
    );
  }
  return data as T;
}

export const api = {
  getWorkspace: () => requestJson<WorkspacePayload>('/api/workspace'),

  resetDemo: () =>
    requestJson<WorkspacePayload>('/api/workspace/reset', { method: 'POST' }),

  startEmpty: (companyName?: string) =>
    requestJson<WorkspacePayload>('/api/workspace/empty', {
      method: 'POST',
      body: JSON.stringify({ companyName }),
    }),

  updateSettings: (patch: Partial<WorkspaceSettings>) =>
    requestJson<WorkspacePayload>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  addSubscription: (payload: {
    vendor: string;
    category?: SubscriptionCategory;
    amount: number;
    previousAmount?: number | null;
    currency: CurrencyCode;
    billingCycle: BillingCycle;
    nextRenewalDate?: string;
    paymentSource?: string;
    ownerName?: string;
    department?: string;
    seatCount?: number | null;
  }) =>
    requestJson<WorkspacePayload>('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSubscription: (
    id: string,
    patch: {
      status?: SubscriptionStatus;
      amount?: number;
      billingCycle?: BillingCycle;
      ownerName?: string;
      department?: string;
      seatCount?: number | null;
    }
  ) =>
    requestJson<WorkspacePayload>(`/api/subscriptions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteSubscription: (id: string) =>
    requestJson<WorkspacePayload>(`/api/subscriptions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  discoverInbox: (rawText: string, source: 'gmail' | 'outlook' = 'gmail') =>
    requestJson<
      WorkspacePayload & {
        parsed: ParsedInvoiceResult;
        created: boolean;
        hikeDetected: PriceHikeAlert | null;
      }
    >('/api/discover/inbox', {
      method: 'POST',
      body: JSON.stringify({ rawText, source }),
    }),

  discoverTransactions: (csvText: string, source: 'csv_import' | 'plaid' = 'csv_import') =>
    requestJson<
      WorkspacePayload & {
        parsedCount: number;
        subscriptionsAdded: number;
        subscriptionsUpdated: number;
        hikesDetected: PriceHikeAlert[];
      }
    >('/api/discover/transactions', {
      method: 'POST',
      body: JSON.stringify({ csvText, source }),
    }),

  discoverSeats: (csvText: string) =>
    requestJson<WorkspacePayload & { importedCount: number }>('/api/discover/seats', {
      method: 'POST',
      body: JSON.stringify({ csvText }),
    }),

  toggleConnector: (id: ConnectorId, connected?: boolean) =>
    requestJson<WorkspacePayload>(`/api/connectors/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ connected }),
    }),

  syncConnector: (id: ConnectorId) =>
    requestJson<WorkspacePayload>(`/api/connectors/${id}/sync`, {
      method: 'POST',
    }),

  actionHike: (id: string, status: HikeStatus) =>
    requestJson<WorkspacePayload>(`/api/hikes/${encodeURIComponent(id)}/action`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  bulkActionSeats: (seatIds: string[], status: ZombieSeatStatus) =>
    requestJson<WorkspacePayload>('/api/seats/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ seatIds, status }),
    }),
};
