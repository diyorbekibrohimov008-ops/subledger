import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import { formatMoney, toMonthlyUsd } from '../../shared/currency';
import type {
  HikeStatus,
  WorkspaceMetrics,
  WorkspaceSettings,
  WorkspaceState,
  ZombieSeatStatus,
} from '../../shared/types';

interface OverviewViewProps {
  state: WorkspaceState;
  metrics: WorkspaceMetrics;
  busy: boolean;
  onNavigate: (tab: 'overview' | 'subscriptions' | 'hikes' | 'zombies' | 'discovery' | 'renewals') => void;
  onQuickAddBill: () => void;
  onUpdateSettings: (patch: Partial<WorkspaceSettings>) => Promise<void>;
  onHikeAction: (id: string, status: HikeStatus) => Promise<void>;
  onSeatAction: (seatIds: string[], status: ZombieSeatStatus) => Promise<void>;
}

export function OverviewView({
  state,
  metrics,
  busy,
  onNavigate,
  onQuickAddBill,
  onUpdateSettings,
  onHikeAction,
  onSeatAction,
}: OverviewViewProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const topUnusedSeats = state.zombieSeats
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

  const totalSavingsAvailableYearly =
    metrics.annualZombieWasteUsd + metrics.annualHikeImpactUsd;

  return (
    <div className="space-y-8">
      {/* Plain-English Intro + Quick Start Bar */}
      <section className="space-y-4">
        <p className="text-base sm:text-lg text-slate-700 leading-relaxed max-w-3xl">
          Track all your recurring software bills in one place, spot price hikes, and find unused seats. 100% free.
        </p>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Quick start:</span>{' '}
            Add a bill or import a CSV
            {totalSavingsAvailableYearly > 0 && (
              <span className="text-slate-500">
                {' '}· {formatMoney(totalSavingsAvailableYearly)}/yr in potential savings found
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onQuickAddBill}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a bill
            </button>
            <button
              type="button"
              onClick={() => onNavigate('discovery')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV or receipt
            </button>
          </div>
        </div>
      </section>

      {/* 3 Clear Summary Numbers (Personal-Finance Ledger Strip) */}
      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
        <div className="grid grid-cols-1 divide-y divide-slate-200/80 md:grid-cols-3 md:divide-x md:divide-y-0">
          <button
            type="button"
            onClick={() => onNavigate('subscriptions')}
            className="p-5 sm:p-6 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="text-sm font-medium text-slate-500">Monthly total</div>
            <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {formatMoney(metrics.monthlySpendUsd)}
            </div>
            <div className="mt-2 text-xs text-slate-500 tabular-nums">
              {metrics.activeSubscriptionCount} active bills · {formatMoney(metrics.annualSpendUsd)}/yr
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('hikes')}
            className="p-5 sm:p-6 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="text-sm font-medium text-slate-500">Price increases</div>
            <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-amber-700 tabular-nums">
              +{formatMoney(metrics.annualHikeImpactUsd)}
              <span className="text-base font-normal text-amber-600">/yr</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {metrics.openHikeCount === 0
                  ? 'No recent increases'
                  : `${metrics.openHikeCount} bill${metrics.openHikeCount === 1 ? '' : 's'} went up`}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                Review <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('zombies')}
            className="p-5 sm:p-6 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="text-sm font-medium text-slate-500">Unused seats</div>
            <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-rose-700 tabular-nums">
              {formatMoney(metrics.monthlyZombieWasteUsd)}
              <span className="text-base font-normal text-rose-600">/mo</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {metrics.flaggedZombieCount} seat{metrics.flaggedZombieCount === 1 ? '' : 's'} to review
              </span>
              <span className="font-medium text-emerald-700">
                {formatMoney(metrics.reclaimedMonthlySavingsUsd)}/mo saved
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Action Queues: Unused Seats + Price Increases */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Unused Seats */}
        <div className="rounded-xl border border-slate-200/90 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Unused seats to review</h2>
              <p className="text-xs text-slate-500">
                Inactive for {state.settings.zombieThresholdDays}+ days or already left the team
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('zombies')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              See all ({metrics.flaggedZombieCount}) →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {topUnusedSeats.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
                Every seat looks active right now.
              </div>
            ) : (
              topUnusedSeats.map((seat) => (
                <div
                  key={seat.id}
                  className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">
                        {seat.employeeName}
                      </span>
                      <span className="text-xs text-slate-500">· {seat.vendor}</span>
                      {seat.employmentStatus === 'offboarded' && (
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">
                          Left team
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Unused for {seat.daysInactive} days ·{' '}
                      <span className="font-mono text-slate-700 tabular-nums">
                        {formatMoney(seat.seatCostMonthlyUsd)}/mo
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSeatAction([seat.id], 'reclaimed')}
                    className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                  >
                    Remove seat
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Price Increases */}
        <div className="rounded-xl border border-slate-200/90 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent price increases</h2>
              <p className="text-xs text-slate-500">
                Bills that rose by {state.settings.priceHikeThresholdPct}% or more
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('hikes')}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              See all ({metrics.openHikeCount}) →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpenHikes.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
                No open price increases to review.
              </div>
            ) : (
              topOpenHikes.map((hike) => (
                <div
                  key={hike.id}
                  className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">{hike.vendor}</span>
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-xs font-medium text-amber-800 tabular-nums">
                        +{hike.percentIncrease}%
                      </span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {formatMoney(hike.previousAmount, hike.currency)} →{' '}
                        {formatMoney(hike.newAmount, hike.currency)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500" title={hike.evidence}>
                      +{formatMoney(hike.annualImpactUsd)}/yr extra
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onHikeAction(hike.id, 'disputing')}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                    >
                      Dispute
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onHikeAction(hike.id, 'downgraded')}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                    >
                      Downgraded
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Spending by Category */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Spending by category</h2>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {formatMoney(metrics.monthlySpendUsd)}/mo total
          </span>
        </div>
        {sortedCategories.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No bills added yet. Add a bill or import a CSV above to see your spending breakdown.
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
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-800 transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Collapsible Secondary Area: Tracking Rules & Activity Log */}
      <section className="rounded-xl border border-slate-200/90 bg-white">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            Alert rules &amp; recent activity
            <span className="text-xs font-normal text-slate-500">
              ({state.settings.zombieThresholdDays}d unused · {state.settings.priceHikeThresholdPct}% price alert · {state.settings.renewalNoticeWindowDays}d renewal reminder)
            </span>
          </span>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="border-t border-slate-200/70 p-5 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700">
                  Flag a seat as unused after
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[14, 30, 45, 60].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={busy}
                      onClick={() => onUpdateSettings({ zombieThresholdDays: days })}
                      className={`rounded-lg px-2.5 py-1.5 font-mono text-xs cursor-pointer ${
                        state.settings.zombieThresholdDays === days
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700">
                  Alert on price increases of at least
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[3, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      disabled={busy}
                      onClick={() => onUpdateSettings({ priceHikeThresholdPct: pct })}
                      className={`rounded-lg px-2.5 py-1.5 font-mono text-xs cursor-pointer ${
                        state.settings.priceHikeThresholdPct === pct
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-700">
                  Renewal reminder window
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      disabled={busy}
                      onClick={() => onUpdateSettings({ renewalNoticeWindowDays: days })}
                      className={`rounded-lg px-2.5 py-1.5 font-mono text-xs cursor-pointer ${
                        state.settings.renewalNoticeWindowDays === days
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/70 pt-4">
              <h3 className="mb-3 text-xs font-semibold text-slate-700">Recent activity</h3>
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {state.logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-4 py-2.5 text-xs">
                    <p className="text-slate-700 leading-relaxed">{log.summary}</p>
                    <span className="shrink-0 font-mono text-slate-400">
                      {log.timestamp.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
