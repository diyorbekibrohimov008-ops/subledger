import { useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '../../shared/currency';
import type { HikeStatus, HikeType, WorkspaceMetrics, WorkspaceState } from '../../shared/types';

interface PriceHikesViewProps {
  state: WorkspaceState;
  metrics: WorkspaceMetrics;
  busy: boolean;
  onHikeAction: (id: string, status: HikeStatus) => Promise<void>;
}

const HIKE_TYPE_LABELS: Record<HikeType, string> = {
  stealth_unit_hike: 'Rate increase',
  tier_creep: 'Plan or add-on bump',
  promo_expiry: 'Intro discount ended',
  fx_drift: 'Currency change',
};

export function PriceHikesView({
  state,
  metrics,
  busy,
  onHikeAction,
}: PriceHikesViewProps) {
  const [filter, setFilter] = useState<'all' | HikeStatus>('all');

  const filtered = state.priceHikes.filter((h) =>
    filter === 'all' ? true : h.status === filter
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Price increases
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {metrics.openHikeCount} bill{metrics.openHikeCount === 1 ? '' : 's'} went up by {state.settings.priceHikeThresholdPct}% or more, adding{' '}
            <span className="font-mono font-medium text-amber-700 tabular-nums">
              +{formatMoney(metrics.annualHikeImpactUsd)}/yr
            </span>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {(['all', 'open', 'disputing', 'downgraded', 'accepted'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize cursor-pointer ${
                filter === tab
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-10 text-center text-sm text-slate-500">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
          No price increases in this view.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white divide-y divide-slate-100">
          {filtered.map((hike) => (
            <div key={hike.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-slate-900">{hike.vendor}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-mono text-xs font-medium text-amber-800 tabular-nums">
                      <AlertTriangle className="h-3 w-3" /> +{hike.percentIncrease}%
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {HIKE_TYPE_LABELS[hike.hikeType]}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        hike.status === 'open'
                          ? 'bg-rose-50 text-rose-700'
                          : hike.status === 'disputing'
                            ? 'bg-amber-50 text-amber-700'
                            : hike.status === 'downgraded'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {hike.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 font-mono tabular-nums">
                      <span className="text-slate-500 line-through">
                        {formatMoney(hike.previousAmount, hike.currency)}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-900">
                        {formatMoney(hike.newAmount, hike.currency)}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-medium text-rose-700 tabular-nums">
                      +{formatMoney(hike.monthlyImpactUsd)}/mo (+{formatMoney(hike.annualImpactUsd)}/yr)
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">{hike.evidence}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy || hike.status === 'disputing'}
                    onClick={() => onHikeAction(hike.id, 'disputing')}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                  >
                    Dispute
                  </button>
                  <button
                    type="button"
                    disabled={busy || hike.status === 'downgraded'}
                    onClick={() => onHikeAction(hike.id, 'downgraded')}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    Mark downgraded
                  </button>
                  <button
                    type="button"
                    disabled={busy || hike.status === 'accepted'}
                    onClick={() => onHikeAction(hike.id, 'accepted')}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
