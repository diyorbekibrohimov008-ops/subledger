import { useState } from 'react';
import { BellRing, Check, X } from 'lucide-react';
import { formatMoney, toMonthlyUsd } from '../../shared/currency';
import { diffDays } from '../../shared/engines/dateUtils';
import type { WorkspaceMetrics, WorkspaceState } from '../../shared/types';

interface RenewalsAndPricingViewProps {
  state: WorkspaceState;
  metrics: WorkspaceMetrics;
}

export function RenewalsAndPricingView({
  state,
  metrics,
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

  return (
    <div className="space-y-6">
      {/* Upcoming Renewals Timeline */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Upcoming renewals
            </h2>
            <p className="text-sm text-slate-500">
              See which bills are coming up soon so you can cancel or adjust plans before they auto-renew.
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
          <p className="py-8 text-center text-sm text-slate-500">
            No bills renewing in the next {windowDays} days.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {upcomingSubs.map(({ sub, daysLeft }) => {
              const urgentAnnual =
                sub.billingCycle === 'annual' && daysLeft <= sub.autoRenewNoticeDays;
              return (
                <div
                  key={sub.id}
                  className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-slate-900">
                        {sub.vendor}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 capitalize">
                        {sub.billingCycle}
                      </span>
                      {urgentAnnual && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                          <BellRing className="h-3 w-3" /> Cancel notice window ({sub.autoRenewNoticeDays}d)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Owner: {sub.ownerName} · {sub.paymentSource}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {formatMoney(sub.amount, sub.currency)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatMoney(toMonthlyUsd(sub.amount, sub.currency, sub.billingCycle))}/mo
                      </div>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 font-mono text-xs font-medium tabular-nums ${
                        daysLeft <= 7
                          ? 'bg-amber-50 text-amber-900'
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

      {/* 100% Free Forever & Comparison */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                SubLedger is 100% free forever
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Every feature is unlocked — no paid plans, no trials, no credit card, and no bill limits.
              </p>
            </div>
            <span className="font-mono text-2xl font-semibold text-emerald-700 shrink-0">
              $0/mo
            </span>
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs text-slate-700 border-t border-slate-100 pt-4">
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Unlimited subscriptions
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Email receipt &amp; CSV import
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Read-only bank &amp; card feeds
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Automatic price increase alerts
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Unused seat finder (SSO &amp; Slack)
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> Renewal alerts &amp; CSV export
            </li>
          </ul>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span>All features active at $0/mo</span>
            <span className="font-mono font-semibold tabular-nums">
              Saves 100% ({formatMoney(metrics.cledaraMonthlyBaselineUsd)}/mo vs. Cledara)
            </span>
          </div>
        </div>

        {/* Competitive Matrix */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-3">
            How SubLedger compares
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Feature</th>
                  <th className="py-2 px-2 font-medium">TrackMySubs</th>
                  <th className="py-2 px-2 font-medium">Cledara</th>
                  <th className="py-2 pl-2 text-emerald-700 font-semibold">SubLedger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Monthly cost</td>
                  <td className="py-2.5 px-2 text-slate-600">$10–$30</td>
                  <td className="py-2.5 px-2 text-rose-700 font-medium">$100–$250+</td>
                  <td className="py-2.5 pl-2 font-semibold text-emerald-700">$0 forever (save 100%)</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Auto-import bills</td>
                  <td className="py-2.5 px-2 text-rose-600">
                    <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Manual</span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">Virtual cards</td>
                  <td className="py-2.5 pl-2 text-emerald-700 font-medium">
                    <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Email &amp; CSV</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Keep current cards</td>
                  <td className="py-2.5 px-2 text-emerald-700">Yes</td>
                  <td className="py-2.5 px-2 text-rose-600">No</td>
                  <td className="py-2.5 pl-2 text-emerald-700 font-medium">Yes</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Price increase alerts</td>
                  <td className="py-2.5 px-2 text-slate-400">No</td>
                  <td className="py-2.5 px-2 text-slate-600">Manual caps</td>
                  <td className="py-2.5 pl-2 text-emerald-700 font-medium">Automatic</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">Unused seat finder</td>
                  <td className="py-2.5 px-2 text-slate-400">No</td>
                  <td className="py-2.5 px-2 text-slate-600">Paid add-on</td>
                  <td className="py-2.5 pl-2 text-emerald-700 font-medium">Included free</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
