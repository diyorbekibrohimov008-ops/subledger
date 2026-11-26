import { useMemo, useState } from 'react';
import {
  CheckSquare,
  MessageSquare,
  ShieldCheck,
  Upload,
  UserX,
} from 'lucide-react';
import { formatMoney } from '../../shared/currency';
import { SAMPLE_SEAT_ACTIVITY_CSV } from '../../shared/seedData';
import type {
  WorkspaceMetrics,
  WorkspaceState,
  ZombieSeatStatus,
} from '../../shared/types';

interface ZombieSeatsViewProps {
  state: WorkspaceState;
  metrics: WorkspaceMetrics;
  busy: boolean;
  onThresholdChange: (days: number) => Promise<void>;
  onSeatAction: (seatIds: string[], status: ZombieSeatStatus) => Promise<void>;
  onImportSeatsCsv: (csvText: string) => Promise<void>;
}

export function ZombieSeatsView({
  state,
  metrics,
  busy,
  onThresholdChange,
  onSeatAction,
  onImportSeatsCsv,
}: ZombieSeatsViewProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'actionable' | 'all' | 'reclaimed' | 'exempt'>('actionable');
  const [showCsvBox, setShowCsvBox] = useState(false);
  const [csvInput, setCsvInput] = useState(SAMPLE_SEAT_ACTIVITY_CSV);

  const threshold = state.settings.zombieThresholdDays;

  const visibleSeats = useMemo(
    () =>
      state.zombieSeats
        .filter((seat) => {
          const isUnused =
            seat.employmentStatus === 'offboarded' || seat.daysInactive >= threshold;
          if (statusFilter === 'actionable') {
            return seat.status !== 'reclaimed' && seat.status !== 'exempt' && isUnused;
          }
          if (statusFilter === 'reclaimed') return seat.status === 'reclaimed';
          if (statusFilter === 'exempt') return seat.status === 'exempt';
          return true;
        })
        .sort((a, b) => {
          if (a.employmentStatus !== b.employmentStatus) {
            return a.employmentStatus === 'offboarded' ? -1 : 1;
          }
          return b.daysInactive - a.daysInactive;
        }),
    [state.zombieSeats, statusFilter, threshold]
  );

  const visibleActionableIds = useMemo(
    () => visibleSeats.filter((s) => s.status !== 'reclaimed').map((s) => s.id),
    [visibleSeats]
  );

  const activeSelectedIds = useMemo(
    () => selectedIds.filter((id) => visibleActionableIds.includes(id)),
    [selectedIds, visibleActionableIds]
  );

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleAllVisible() {
    if (
      visibleActionableIds.length > 0 &&
      visibleActionableIds.every((id) => activeSelectedIds.includes(id))
    ) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleActionableIds);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Summary + Cutoff Selector */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Unused seats
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {metrics.flaggedZombieCount} seat{metrics.flaggedZombieCount === 1 ? '' : 's'} unused for {threshold}+ days, costing{' '}
              <span className="font-mono font-medium text-rose-700 tabular-nums">
                {formatMoney(metrics.monthlyZombieWasteUsd)}/mo
              </span>
              . Already saved:{' '}
              <span className="font-mono font-medium text-emerald-700 tabular-nums">
                {formatMoney(metrics.reclaimedAnnualSavingsUsd)}/yr
              </span>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500">Unused after:</span>
            {[14, 30, 45, 60].map((days) => (
              <button
                key={days}
                type="button"
                disabled={busy}
                onClick={() => onThresholdChange(days)}
                className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-medium cursor-pointer ${
                  threshold === days
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {days}d+
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCsvBox((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              Import seat CSV
            </button>
          </div>
        </div>
      </div>

      {showCsvBox && (
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-800">
              Import Google Workspace or Slack seat activity CSV
            </h3>
            <button
              type="button"
              onClick={() => setCsvInput(SAMPLE_SEAT_ACTIVITY_CSV)}
              className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
            >
              Load sample CSV
            </button>
          </div>
          <textarea
            rows={4}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-2.5 font-mono text-xs text-slate-800"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCsvBox(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onImportSeatsCsv(csvInput);
                setShowCsvBox(false);
              }}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
            >
              Import seats
            </button>
          </div>
        </div>
      )}

      {/* Filter & Bulk Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['actionable', `To review (${metrics.flaggedZombieCount})`],
              ['reclaimed', 'Removed'],
              ['exempt', 'Kept'],
              ['all', `All (${state.zombieSeats.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setStatusFilter(key);
                setSelectedIds([]);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                statusFilter === key
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeSelectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {activeSelectedIds.length} selected
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onSeatAction(activeSelectedIds, 'reclaimed');
                setSelectedIds([]);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Remove selected
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onSeatAction(activeSelectedIds, 'nudge_sent');
                setSelectedIds([]);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Send check-in
            </button>
          </div>
        )}
      </div>

      {/* Seats Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200/80 bg-slate-50/70 text-xs font-medium text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    onChange={toggleAllVisible}
                    checked={
                      visibleActionableIds.length > 0 &&
                      visibleActionableIds.every((id) => activeSelectedIds.includes(id))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                    aria-label="Select all visible seats"
                  />
                </th>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3">Unused for</th>
                <th className="px-4 py-3">Seat cost</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSeats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                    No unused seats in this view.
                  </td>
                </tr>
              ) : (
                visibleSeats.map((seat) => (
                  <tr key={seat.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={activeSelectedIds.includes(seat.id)}
                        disabled={seat.status === 'reclaimed'}
                        onChange={() => toggleOne(seat.id)}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label={`Select ${seat.employeeName}`}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {seat.employeeName}
                        </span>
                        {seat.employmentStatus === 'offboarded' && (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">
                            <UserX className="h-3 w-3" /> Left team
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {seat.employeeEmail} · {seat.department}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-slate-900">{seat.vendor}</span>
                      <div className="text-[11px] text-slate-500 capitalize">
                        {seat.status.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div>Google: {seat.lastSsoLoginAt ?? 'Never'}</div>
                      <div>Slack: {seat.lastSlackActiveAt ?? 'Never'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-mono text-xs font-medium tabular-nums ${
                          seat.daysInactive >= 45 || seat.employmentStatus === 'offboarded'
                            ? 'bg-rose-50 text-rose-700'
                            : seat.daysInactive >= threshold
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {seat.daysInactive}d
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-medium text-slate-900 tabular-nums">
                      {formatMoney(seat.seatCostMonthlyUsd)}/mo
                      <div className="text-[11px] font-normal text-slate-500">
                        {formatMoney(seat.seatCostMonthlyUsd * 12)}/yr
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {seat.status === 'reclaimed' ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Removed {seat.reclaimedAt}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onSeatAction([seat.id], 'reclaimed')}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            Remove seat
                          </button>
                          {seat.status !== 'nudge_sent' && seat.employmentStatus === 'active' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onSeatAction([seat.id], 'nudge_sent')}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                            >
                              Check in
                            </button>
                          )}
                          {seat.status !== 'exempt' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onSeatAction([seat.id], 'exempt')}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                            >
                              Keep
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
