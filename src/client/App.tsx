import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  Download,
  Layers,
  LayoutDashboard,
  RotateCcw,
  RefreshCw,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import { api } from './api';
import { DiscoveryView } from './components/DiscoveryView';
import { OverviewView } from './components/OverviewView';
import { PriceHikesView } from './components/PriceHikesView';
import { RenewalsAndPricingView } from './components/RenewalsAndPricingView';
import { SubscriptionsView } from './components/SubscriptionsView';
import { ZombieSeatsView } from './components/ZombieSeatsView';
import type {
  BillingCycle,
  ConnectorId,
  CurrencyCode,
  HikeStatus,
  SubscriptionCategory,
  SubscriptionStatus,
  WorkspaceMetrics,
  WorkspaceSettings,
  WorkspaceState,
  ZombieSeatStatus,
} from '../shared/types';

type TabId =
  | 'overview'
  | 'subscriptions'
  | 'hikes'
  | 'zombies'
  | 'discovery'
  | 'renewals';

export default function App() {
  const [tab, setTab] = useState<TabId>('overview');
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [openAddBillCount, setOpenAddBillCount] = useState(0);
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ kind, text });
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      const data = await api.getWorkspace();
      setState(data.state);
      setMetrics(data.metrics);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load workspace', 'err');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  async function runAction<T extends { state: WorkspaceState; metrics: WorkspaceMetrics }>(
    fn: () => Promise<T>,
    successMsg?: string | ((res: T) => string)
  ) {
    setBusy(true);
    try {
      const res = await fn();
      setState(res.state);
      setMetrics(res.metrics);
      if (successMsg) {
        const msg = typeof successMsg === 'function' ? successMsg(res) : successMsg;
        notify(msg, 'ok');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Action failed', 'err');
    } finally {
      setBusy(false);
    }
  }

  function handleQuickAddBill() {
    setTab('subscriptions');
    setOpenAddBillCount((c) => c + 1);
  }

  if (loading || !state || !metrics) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading SubLedger...
      </div>
    );
  }

  const navItems: {
    id: TabId;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
    badgeTone?: string;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'subscriptions',
      label: 'Subscriptions',
      icon: Layers,
      badge: metrics.activeSubscriptionCount,
      badgeTone: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'hikes',
      label: 'Price Increases',
      icon: TrendingUp,
      badge: metrics.openHikeCount,
      badgeTone: metrics.openHikeCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600',
    },
    {
      id: 'zombies',
      label: 'Unused Seats',
      icon: Users,
      badge: metrics.flaggedZombieCount,
      badgeTone: metrics.flaggedZombieCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600',
    },
    { id: 'discovery', label: 'Import Bills', icon: Upload },
    { id: 'renewals', label: 'Renewals', icon: CalendarClock },
  ];

  const connectedCount = state.connectors.filter((c) => c.connected).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200/80 lg:bg-white lg:p-5 shrink-0">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-400 font-semibold text-sm">
            SL
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900">SubLedger</div>
            <div className="text-xs font-medium text-emerald-700">100% Free · $0/mo</div>
          </div>
        </div>

        <nav className="mt-7 flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {typeof item.badge === 'number' && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums ${
                      active ? 'bg-white/20 text-white' : item.badgeTone
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs space-y-2">
          <div className="font-semibold text-slate-900">Free forever, read-only</div>
          <p className="text-slate-600 leading-relaxed">
            Every feature is unlocked at $0/mo. Keep your existing bank accounts and cards.
          </p>
          <button
            type="button"
            onClick={() => setTab('renewals')}
            className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
          >
            Compare vs. paid tools →
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur px-4 py-3.5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-emerald-400 font-semibold text-xs">
                  SL
                </div>
                <span className="font-semibold text-sm text-slate-900">SubLedger</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-semibold text-slate-900">
                    {state.settings.companyName}
                  </h1>
                  <span className="hidden sm:inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    Free forever
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {connectedCount} of {state.connectors.length} accounts connected · As of {state.settings.referenceDate}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/export/csv"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => api.startEmpty('My Workspace'),
                    'Started a blank workspace. Add a bill or import a CSV to begin.'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Start blank
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(() => api.resetDemo(), 'Loaded sample workspace data.')
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Load demo
              </button>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {item.label}
                  {typeof item.badge === 'number' ? ` (${item.badge})` : ''}
                </button>
              );
            })}
          </div>
        </header>

        {/* Toast Banner */}
        {toast && (
          <div className="mx-4 mt-4 sm:mx-6">
            <div
              className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
                toast.kind === 'err'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {toast.text}
            </div>
          </div>
        )}

        {/* Active View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {tab === 'overview' && (
            <OverviewView
              state={state}
              metrics={metrics}
              busy={busy}
              onNavigate={setTab}
              onQuickAddBill={handleQuickAddBill}
              onUpdateSettings={(patch: Partial<WorkspaceSettings>) =>
                runAction(() => api.updateSettings(patch), 'Updated tracking rules.')
              }
              onHikeAction={(id: string, status: HikeStatus) =>
                runAction(() => api.actionHike(id, status), `Marked price increase as ${status}.`)
              }
              onSeatAction={(seatIds: string[], status: ZombieSeatStatus) =>
                runAction(
                  () => api.bulkActionSeats(seatIds, status),
                  `Updated ${seatIds.length} seat(s).`
                )
              }
            />
          )}

          {tab === 'subscriptions' && (
            <SubscriptionsView
              state={state}
              busy={busy}
              autoOpenAddCount={openAddBillCount}
              onAdd={(payload: {
                vendor: string;
                category: SubscriptionCategory;
                amount: number;
                previousAmount?: number | null;
                currency: CurrencyCode;
                billingCycle: BillingCycle;
                paymentSource: string;
                ownerName: string;
                department: string;
                seatCount: number | null;
              }) =>
                runAction(
                  () => api.addSubscription(payload),
                  `Added ${payload.vendor} to your subscriptions.`
                )
              }
              onUpdate={(
                id: string,
                patch: {
                  status?: SubscriptionStatus;
                  amount?: number;
                  billingCycle?: BillingCycle;
                  ownerName?: string;
                  department?: string;
                  seatCount?: number | null;
                }
              ) => runAction(() => api.updateSubscription(id, patch), 'Subscription updated.')}
              onDelete={(id: string) =>
                runAction(() => api.deleteSubscription(id), 'Subscription removed.')
              }
            />
          )}

          {tab === 'hikes' && (
            <PriceHikesView
              state={state}
              metrics={metrics}
              busy={busy}
              onHikeAction={(id: string, status: HikeStatus) =>
                runAction(() => api.actionHike(id, status), `Marked price increase as ${status}.`)
              }
            />
          )}

          {tab === 'zombies' && (
            <ZombieSeatsView
              state={state}
              metrics={metrics}
              busy={busy}
              onThresholdChange={(days: number) =>
                runAction(
                  () => api.updateSettings({ zombieThresholdDays: days }),
                  `Flagging seats unused for ${days}+ days.`
                )
              }
              onSeatAction={(seatIds: string[], status: ZombieSeatStatus) =>
                runAction(
                  () => api.bulkActionSeats(seatIds, status),
                  `Updated ${seatIds.length} seat(s).`
                )
              }
              onImportSeatsCsv={(csvText: string) =>
                runAction(
                  () => api.discoverSeats(csvText),
                  (res) => `Imported ${res.importedCount} seat activity row(s).`
                )
              }
            />
          )}

          {tab === 'discovery' && (
            <DiscoveryView
              state={state}
              busy={busy}
              onToggleConnector={(id: ConnectorId, connected: boolean) =>
                runAction(
                  () => api.toggleConnector(id, connected),
                  `${id.replace('_', ' ')} ${connected ? 'connected (read-only)' : 'disconnected'}.`
                )
              }
              onSyncConnector={(id: ConnectorId) =>
                runAction(
                  () => api.syncConnector(id),
                  `Synced ${id.replace('_', ' ')} in read-only mode.`
                )
              }
              onScanInbox={(rawText: string, source: 'gmail' | 'outlook') =>
                runAction(
                  () => api.discoverInbox(rawText, source),
                  (res) =>
                    `${res.parsed.vendor} (${res.parsed.currency} ${res.parsed.amount}/${res.parsed.billingCycle}) ${
                      res.created ? 'added' : 'updated'
                    }${res.hikeDetected ? ` — +${res.hikeDetected.percentIncrease}% price increase found.` : '.'}`
                )
              }
              onScanTransactions={(csvText: string, source: 'csv_import' | 'plaid') =>
                runAction(
                  () => api.discoverTransactions(csvText, source),
                  (res) =>
                    `Imported ${res.parsedCount} rows: ${res.subscriptionsAdded} added, ${res.subscriptionsUpdated} updated, ${res.hikesDetected.length} price increase(s) spotted.`
                )
              }
            />
          )}

          {tab === 'renewals' && (
            <RenewalsAndPricingView state={state} metrics={metrics} />
          )}
        </main>
      </div>
    </div>
  );
}
