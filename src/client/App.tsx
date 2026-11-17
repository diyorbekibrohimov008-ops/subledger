import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  Download,
  Ghost,
  Layers,
  LayoutDashboard,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TrendingUp,
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
  PlanTier,
  SubscriptionCategory,
  SubscriptionStatus,
  WorkspaceMetrics,
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

  const notify = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ kind, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
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

  if (loading || !state || !metrics) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Loading SubLedger workspace...
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
      badgeTone: 'bg-slate-200 text-slate-800',
    },
    {
      id: 'hikes',
      label: 'Price Hikes',
      icon: TrendingUp,
      badge: metrics.openHikeCount,
      badgeTone: metrics.openHikeCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700',
    },
    {
      id: 'zombies',
      label: 'Zombie Seats',
      icon: Ghost,
      badge: metrics.flaggedZombieCount,
      badgeTone: metrics.flaggedZombieCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700',
    },
    { id: 'discovery', label: 'Discovery & Sync', icon: PlugZap },
    { id: 'renewals', label: 'Renewals & $9/$19', icon: CalendarClock },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:p-4 shrink-0">
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-400 font-bold text-sm">
              SL
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900">SubLedger</div>
              <div className="text-[11px] font-medium text-emerald-700">
                ${metrics.planPriceMonthlyUsd}/mo SMB Flat
              </div>
            </div>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
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
                    className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
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

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2">
          <div className="font-semibold text-slate-900">No Banking Overhaul</div>
          <p className="text-slate-600 leading-relaxed">
            Connected via read-only Gmail, Outlook, Plaid, Google SSO &amp; Slack. Keep your primary bank &amp; cards.
          </p>
          <button
            type="button"
            onClick={() => setTab('renewals')}
            className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
          >
            Compare vs. Cledara &amp; TrackMySubs →
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 lg:hidden">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-emerald-400 font-bold text-xs">
                  SL
                </div>
                <span className="font-bold text-sm text-slate-900">SubLedger</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900">
                    {state.settings.companyName}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <Sparkles className="h-3 w-3" />
                    {state.settings.planTier === 'starter_9' ? '$9/mo Starter' : '$19/mo Growth'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Reference date: {state.settings.referenceDate} ·{' '}
                  {state.connectors.filter((c) => c.connected).length} of {state.connectors.length} read-only connectors active
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/export/csv"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    () => api.startEmpty('Fresh SMB Workspace'),
                    'Started clean empty workspace — test Zero-Setup Discovery from scratch!'
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Empty Mode
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction(() => api.resetDemo(), 'Restored Northstar Studio SMB demo dataset.')
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset Demo
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
              className={`rounded-lg border px-4 py-2.5 text-xs font-medium shadow-xs ${
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
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {tab === 'overview' && (
            <OverviewView
              state={state}
              metrics={metrics}
              busy={busy}
              onNavigate={setTab}
              onHikeAction={(id: string, status: HikeStatus) =>
                runAction(() => api.actionHike(id, status), `Price hike marked as ${status}.`)
              }
              onSeatAction={(seatIds: string[], status: ZombieSeatStatus) =>
                runAction(
                  () => api.bulkActionSeats(seatIds, status),
                  `Updated ${seatIds.length} seat(s) to ${status.replace('_', ' ')}.`
                )
              }
            />
          )}

          {tab === 'subscriptions' && (
            <SubscriptionsView
              state={state}
              busy={busy}
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
                  `Added ${payload.vendor} to your ledger.`
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
                runAction(() => api.actionHike(id, status), `Price hike marked as ${status}.`)
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
                  `Zombie inactivity threshold set to ${days}+ days.`
                )
              }
              onSeatAction={(seatIds: string[], status: ZombieSeatStatus) =>
                runAction(
                  () => api.bulkActionSeats(seatIds, status),
                  `Updated ${seatIds.length} seat(s) to ${status.replace('_', ' ')}.`
                )
              }
              onImportSeatsCsv={(csvText: string) =>
                runAction(
                  () => api.discoverSeats(csvText),
                  (res) => `Imported ${res.importedCount} identity seat activity row(s).`
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
                  `Live read-only sync completed for ${id.replace('_', ' ')}.`
                )
              }
              onScanInbox={(rawText: string, source: 'gmail' | 'outlook') =>
                runAction(
                  () => api.discoverInbox(rawText, source),
                  (res) =>
                    `${res.parsed.vendor} (${res.parsed.currency} ${res.parsed.amount}/${res.parsed.billingCycle}) ${
                      res.created ? 'discovered' : 'updated'
                    }${res.hikeDetected ? ` — +${res.hikeDetected.percentIncrease}% hike caught!` : '!'}`
                )
              }
              onScanTransactions={(csvText: string, source: 'csv_import' | 'plaid') =>
                runAction(
                  () => api.discoverTransactions(csvText, source),
                  (res) =>
                    `Scanned ${res.parsedCount} rows: ${res.subscriptionsAdded} added, ${res.subscriptionsUpdated} updated, ${res.hikesDetected.length} stealth hike(s) caught.`
                )
              }
            />
          )}

          {tab === 'renewals' && (
            <RenewalsAndPricingView
              state={state}
              metrics={metrics}
              busy={busy}
              onSelectPlan={(planTier: PlanTier) =>
                runAction(
                  () => api.updateSettings({ planTier }),
                  `Switched to ${planTier === 'starter_9' ? 'Starter ($9/mo)' : 'Growth ($19/mo)'} flat tier.`
                )
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
