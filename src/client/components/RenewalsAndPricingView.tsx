import { useState } from 'react';
import { BellRing, CalendarClock, Check, Sparkles, X } from 'lucide-react';
import { formatMoney, toMonthlyUsd } from '../../shared/currency';
import { diffDays } from '../../shared/engines/dateUtils';
import type { PlanTier, WorkspaceMetrics, WorkspaceState } from '../../shared/types';

interface RenewalsAndPricingViewProps {
  state: WorkspaceState;
  metrics: WorkspaceMetrics;
  busy: boolean;
  onSelectPlan: (tier: PlanTier) => Promise<void>;
}

export function RenewalsAndPricingView({
  state,
  metrics,
  busy,
  onSelectPlan,
}: RenewalsAndPricingViewProps) {
  const [windowDays, setWindowDays] = useState<number>(30);

  const upcomingSubs = state.subscriptions
    .filter((s) => s.status !== 'canceled')
    .map((s) => ({
      sub: s,
      daysLeft: diffDays(state.settings.referenceDate, s.nextRenewalDate),
    }))
    .filter((item) => item.daysLeft >= 0 && item.daysLeft <= windowDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const activeTier = state.settings.planTier;

  return (
    <div className="space-y-6">
      {/* Upcoming Renewals Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-600" />
              Upcoming Renewals &amp; Auto-Renew Deadlines
            </h2>
            <p className="text-xs text-slate-500">
              Catch annual auto-renewals before cancellation notice windows lock you in for another year.
            </p>
          </div>
          <div className="flex gap-1.5">
            {[14, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium cursor-pointer ${
                  windowDays === d
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Next {d}d
              </button>
            ))}
          </div>
        </div>

        {upcomingSubs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No renewals in the next {windowDays} days.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcomingSubs.map(({ sub, daysLeft }) => {
              const urgentAnnual =
                sub.billingCycle === 'annual' && daysLeft <= sub.autoRenewNoticeDays;
              return (
                <div
                  key={sub.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {sub.vendor}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 capitalize">
                        {sub.billingCycle}
                      </span>
                      {urgentAnnual && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                          <BellRing className="h-3 w-3" /> Annual Notice Window ({sub.autoRenewNoticeDays}d)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Owner: {sub.ownerName} · {sub.paymentSource}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatMoney(sub.amount, sub.currency)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ({formatMoney(toMonthlyUsd(sub.amount, sub.currency, sub.billingCycle))}/mo eq.)
                      </div>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold tabular-nums ${
                        daysLeft <= 7
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sub.nextRenewalDate} ({daysLeft}d)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pricing & Competitive Matrix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* $9 / $19 SMB Flat Tiers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-3 w-3" /> Affordable SMB Tier
            </span>
            <h3 className="mt-2 text-base font-semibold text-slate-900">
              Flat $9–$19/month — Zero Banking Overhaul
            </h3>
            <p className="text-xs text-slate-500">
              Switch your workspace plan below to recalculate ROI payback live.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className={`rounded-xl border p-4 ${
                activeTier === 'starter_9'
                  ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-900">Starter SMB</span>
                <span className="font-mono text-xl font-bold text-slate-900">$9/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Up to 25 subscriptions
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Read-only Gmail/Outlook/CSV
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Stealth price-hike alerts
                </li>
              </ul>
              <button
                type="button"
                disabled={busy || activeTier === 'starter_9'}
                onClick={() => onSelectPlan('starter_9')}
                className={`mt-4 w-full rounded-lg py-2 text-xs font-semibold cursor-pointer ${
                  activeTier === 'starter_9'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {activeTier === 'starter_9' ? 'Active Plan' : 'Switch to $9/mo'}
              </button>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                activeTier === 'growth_19'
                  ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-900">Growth SMB</span>
                <span className="font-mono text-xl font-bold text-slate-900">$19/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Unlimited subscriptions
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Plaid read-only card feed
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> SSO + Slack Zombie Detector
                </li>
              </ul>
              <button
                type="button"
                disabled={busy || activeTier === 'growth_19'}
                onClick={() => onSelectPlan('growth_19')}
                className={`mt-4 w-full rounded-lg py-2 text-xs font-semibold cursor-pointer ${
                  activeTier === 'growth_19'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {activeTier === 'growth_19' ? 'Active Plan' : 'Switch to $19/mo'}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-slate-900 p-3.5 text-xs text-slate-200 flex items-center justify-between">
            <span>Current Workspace Savings vs. Plan Cost:</span>
            <span className="font-mono text-sm font-bold text-emerald-400">
              {metrics.netPaybackMultiple}× ROI ({formatMoney(metrics.monthlyZombieWasteUsd + metrics.reclaimedMonthlySavingsUsd)}/mo seats + hikes)
            </span>
          </div>
        </div>

        {/* Competitive Matrix */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-base font-semibold text-slate-900 mb-3">
            Why SMBs Switch from TrackMySubs &amp; Cledara
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Capability</th>
                  <th className="py-2 px-2">TrackMySubs</th>
                  <th className="py-2 px-2">Cledara</th>
                  <th className="py-2 pl-2 text-emerald-700 font-bold">SubLedger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Monthly Price</td>
                  <td className="py-2.5 px-2 text-slate-600">$10–$30</td>
                  <td className="py-2.5 px-2 text-rose-700 font-medium">$100–$250+</td>
                  <td className="py-2.5 pl-2 font-bold text-emerald-700">$9–$19 flat</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Inbox &amp; Plaid Discovery</td>
                  <td className="py-2.5 px-2 text-rose-600">
                    <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Manual entry</span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">Via virtual cards</td>
                  <td className="py-2.5 pl-2 text-emerald-700 font-medium">
                    <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Read-only auto</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Keep Existing Bank/Cards</td>
                  <td className="py-2.5 px-2 text-emerald-700">Yes (manual)</td>
                  <td className="py-2.5 px-2 text-rose-600">No (forces virtual cards)</td>
                  <td className="py-2.5 pl-2 text-emerald-700 font-medium">Yes (0 overhaul)</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Stealth Price Hike Alerts</td>
                  <td className="py-2.5 px-2 text-slate-400">No</td>
                  <td className="py-2.5 px-2 text-slate-600">Manual spend caps</td>
                  <td className="py-2.5 pl-2 text-emerald-700 font-medium">Automatic % diff</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">30+ Day Zombie Seat Detector</td>
                  <td className="py-2.5 px-2 text-slate-400">No</td>
                  <td className="py-2.5 px-2 text-slate-600">Enterprise add-on</td>
                  <td className="py-2.5 pl-2 text-emerald-700 font-medium">Google SSO + Slack</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
