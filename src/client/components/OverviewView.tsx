import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Ghost,
  Mail,
  Sparkles,
  TrendingUp,
  UserX,
} from 'lucide-react';
import { formatMoney, toMonthlyUsd } from '../../shared/currency';
import type {
  HikeStatus,
  WorkspaceMetrics,
  WorkspaceState,
  ZombieSeatStatus,
} from '../../shared/types';

interface OverviewViewProps {
  state: WorkspaceState;
  metrics: WorkspaceMetrics;
  busy: boolean;
  onNavigate: (tab: 'overview' | 'subscriptions' | 'hikes' | 'zombies' | 'discovery' | 'renewals') => void;
  onHikeAction: (id: string, status: HikeStatus) => Promise<void>;
  onSeatAction: (seatIds: string[], status: ZombieSeatStatus) => Promise<void>;
}

export function OverviewView({
  state,
  metrics,
  busy,
  onNavigate,
  onHikeAction,
  onSeatAction,
}: OverviewViewProps) {
  const activeSubs = state.subscriptions.filter((s) => s.status !== 'canceled');
  const categoryTotals = new Map<string, number>();
  for (const sub of activeSubs) {
    const monthly = toMonthlyUsd(sub.amount, sub.currency, sub.billingCycle);
    categoryTotals.set(sub.category, (categoryTotals.get(sub.category) ?? 0) + monthly);
  }
  const sortedCategories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const maxCategory = sortedCategories[0]?.[1] || 1;

  const topOpenHikes = state.priceHikes
    .filter((h) => h.status === 'open' || h.status === 'disputing')
    .sort((a, b) => b.annualImpactUsd - a.annualImpactUsd)
    .slice(0, 4);

  const topZombies = state.zombieSeats
    .filter(
      (z) =>
        z.status !== 'reclaimed' &&
        z.status !== 'exempt' &&
        (z.employmentStatus === 'offboarded' ||
          z.daysInactive >= state.settings.zombieThresholdDays)
    )
    .sort((a, b) => {
      if (a.employmentStatus !== b.employmentStatus) {
        return a.employmentStatus === 'offboarded' ? -1 : 1;
      }
      return b.seatCostMonthlyUsd - a.seatCostMonthlyUsd;
    })
    .slice(0, 4);

  const totalReclaimableYearly =
    metrics.annualZombieWasteUsd + metrics.annualHikeImpactUsd;

  return (
    <div className="space-y-6">
      {/* Payback & Positioning Banner */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-slate-50 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" />
              Zero-Setup Discovery · ${metrics.planPriceMonthlyUsd}/mo SMB Flat Tier
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              {formatMoney(totalReclaimableYearly)}/yr in reclaimable zombie seats &amp; stealth price hikes detected
            </h2>
            <p className="text-sm text-slate-600">
              Keeping your existing cards &amp; banks ({state.connectors.filter((c) => c.connected).length} read-only feeds active).
              Saves <span className="font-semibold text-slate-900">{formatMoney(metrics.cledaraMonthlyBaselineUsd - metrics.planPriceMonthlyUsd)}/mo</span> vs. Cledara&apos;s $100–$250+/mo virtual-card switch and skips TrackMySubs&apos;s manual entry.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-right">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                ROI vs. ${metrics.planPriceMonthlyUsd}/mo Plan
              </div>
              <div className="font-mono text-xl font-bold text-emerald-700 tabular-nums">
                {metrics.netPaybackMultiple}× payback
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('discovery')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Mail className="h-4 w-4" />
              Discover More
            </button>
          </div>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>MONTHLY SAAS SPEND</span>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(metrics.monthlySpendUsd)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{metrics.activeSubscriptionCount} active subscriptions</span>
            <span className="font-mono tabular-nums">{formatMoney(metrics.annualSpendUsd)}/yr</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('zombies')}
          className="rounded-xl border border-rose-200 bg-white p-4 text-left shadow-xs hover:border-rose-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-rose-700">
            <span>ZOMBIE SEATS ({state.settings.zombieThresholdDays}+ DAYS)</span>
            <Ghost className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-rose-700 tabular-nums">
            {formatMoney(metrics.monthlyZombieWasteUsd)}
            <span className="text-sm font-normal text-rose-600">/mo</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
            <span>
              {metrics.flaggedZombieCount} flagged
              {metrics.offboardedZombieCount > 0 ? ` (${metrics.offboardedZombieCount} offboarded)` : ''}
            </span>
            <span className="font-medium text-emerald-700">
              {formatMoney(metrics.reclaimedMonthlySavingsUsd)}/mo saved
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('hikes')}
          className="rounded-xl border border-amber-200 bg-white p-4 text-left shadow-xs hover:border-amber-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-amber-800">
            <span>STEALTH PRICE HIKES</span>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            +{formatMoney(metrics.annualHikeImpactUsd)}
            <span className="text-sm font-normal text-amber-600">/yr</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
            <span>{metrics.openHikeCount} open price increases</span>
            <span className="inline-flex items-center gap-0.5 text-amber-700 font-medium">
              Review <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('renewals')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>RENEWING IN {state.settings.renewalNoticeWindowDays} DAYS</span>
            <CalendarClock className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.upcomingRenewals14dCount} tools
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Upcoming monthly equiv.</span>
            <span className="font-mono font-medium text-slate-700 tabular-nums">
              {formatMoney(metrics.upcomingRenewals14dUsd)}/mo
            </span>
          </div>
        </button>
      </div>

      {/* Action Queues: Zombie Seats + Stealth Price Hikes */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Zombie Seats Queue */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Top Zombie Seats to Reclaim
              </h3>
              <p className="text-xs text-slate-500">
                Cross-checked via Google Workspace SSO &amp; Slack ({state.settings.zombieThresholdDays}+ days inactive)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('zombies')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              View all ({metrics.flaggedZombieCount}) →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {topZombies.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                Zero unaddressed zombie seats above {state.settings.zombieThresholdDays} days.
              </div>
            ) : (
              topZombies.map((seat) => (
                <div
                  key={seat.id}
                  className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">
                        {seat.employeeName}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                        {seat.vendor}
                      </span>
                      {seat.employmentStatus === 'offboarded' && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-800">
                          <UserX className="h-3 w-3" /> Offboarded
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {seat.daysInactive} days inactive · Last seen{' '}
                      {seat.lastAppActivityAt ?? 'never'} ·{' '}
                      <span className="font-mono font-medium text-slate-700">
                        {formatMoney(seat.seatCostMonthlyUsd)}/mo
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSeatAction([seat.id], 'reclaimed')}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                    >
                      Reclaim ${seat.seatCostMonthlyUsd}/mo
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stealth Price Hikes Queue */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Stealth Price Hikes Detected
              </h3>
              <p className="text-xs text-slate-500">
                Silent unit-rate jumps caught across invoices &amp; card feeds
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('hikes')}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 cursor-pointer"
            >
              View all ({metrics.openHikeCount}) →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpenHikes.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                No open stealth price hikes right now.
              </div>
            ) : (
              topOpenHikes.map((hike) => (
                <div
                  key={hike.id}
                  className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">
                        {hike.vendor}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800 tabular-nums">
                        <AlertTriangle className="h-3 w-3" />+{hike.percentIncrease}%
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatMoney(hike.previousAmount, hike.currency)} →{' '}
                        {formatMoney(hike.newAmount, hike.currency)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500" title={hike.evidence}>
                      +{formatMoney(hike.annualImpactUsd)}/yr impact · {hike.evidence}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onHikeAction(hike.id, 'disputing')}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                    >
                      Dispute
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onHikeAction(hike.id, 'downgraded')}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                    >
                      Downgrade
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown & Recent Discovery Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Monthly Spend by Category
            </h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              Total {formatMoney(metrics.monthlySpendUsd)}/mo
            </span>
          </div>
          {sortedCategories.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No active subscriptions yet. Run Zero-Setup Discovery to populate spend.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedCategories.map(([cat, amount]) => {
                const pct = Math.max(4, Math.round((amount / maxCategory) * 100));
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{cat}</span>
                      <span className="font-mono font-medium text-slate-900 tabular-nums">
                        {formatMoney(amount)}/mo
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            Live Discovery &amp; Reclamation Log
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {state.logs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span className="uppercase tracking-wide">{log.kind.replace('_', ' ')}</span>
                  <span>{log.timestamp.slice(0, 10)}</span>
                </div>
                <p className="mt-1 text-slate-700 leading-relaxed">{log.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
