import { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatMoney, toMonthlyUsd } from '../../shared/currency';
import type {
  BillingCycle,
  CurrencyCode,
  Subscription,
  SubscriptionCategory,
  SubscriptionStatus,
  WorkspaceState,
} from '../../shared/types';

interface SubscriptionsViewProps {
  state: WorkspaceState;
  busy: boolean;
  onAdd: (payload: {
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
  }) => Promise<void>;
  onUpdate: (
    id: string,
    patch: {
      status?: SubscriptionStatus;
      amount?: number;
      billingCycle?: BillingCycle;
      ownerName?: string;
      department?: string;
      seatCount?: number | null;
    }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CATEGORIES: SubscriptionCategory[] = [
  'Design',
  'Collaboration',
  'AI & Dev',
  'CRM & Sales',
  'Infrastructure',
  'Finance & Ops',
  'Security',
  'Other',
];

const SOURCE_BADGES: Record<string, string> = {
  gmail: 'bg-sky-50 text-sky-700 border-sky-200',
  outlook: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  plaid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  csv_import: 'bg-amber-50 text-amber-800 border-amber-200',
  manual: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function SubscriptionsView({
  state,
  busy,
  onAdd,
  onUpdate,
  onDelete,
}: SubscriptionsViewProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState<SubscriptionCategory>('Collaboration');
  const [amount, setAmount] = useState('49');
  const [previousAmount, setPreviousAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paymentSource, setPaymentSource] = useState('Chase Ink ••4821');
  const [ownerName, setOwnerName] = useState('Devon Brooks');
  const [department, setDepartment] = useState('Operations');
  const [seatCount, setSeatCount] = useState('10');

  const hikeMap = new Map(
    state.priceHikes
      .filter((h) => h.status === 'open' || h.status === 'disputing')
      .map((h) => [h.subscriptionId, h])
  );

  const zombieCountBySub = new Map<string, number>();
  for (const seat of state.zombieSeats) {
    if (
      seat.status !== 'reclaimed' &&
      seat.status !== 'exempt' &&
      (seat.employmentStatus === 'offboarded' ||
        seat.daysInactive >= state.settings.zombieThresholdDays)
    ) {
      zombieCountBySub.set(
        seat.subscriptionId,
        (zombieCountBySub.get(seat.subscriptionId) ?? 0) + 1
      );
    }
  }

  const filtered = state.subscriptions.filter((sub) => {
    if (categoryFilter !== 'all' && sub.category !== categoryFilter) return false;
    if (sourceFilter !== 'all' && sub.discoverySource !== sourceFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        sub.vendor.toLowerCase().includes(q) ||
        sub.ownerName.toLowerCase().includes(q) ||
        sub.department.toLowerCase().includes(q) ||
        sub.paymentSource.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const liveSelected = selectedSub
    ? state.subscriptions.find((s) => s.id === selectedSub.id) ?? null
    : null;

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericAmount = Number.parseFloat(amount);
    const numericPrev = previousAmount ? Number.parseFloat(previousAmount) : null;
    const numericSeats = seatCount ? Number.parseInt(seatCount, 10) : null;
    if (!vendor.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;

    await onAdd({
      vendor: vendor.trim(),
      category,
      amount: numericAmount,
      previousAmount: numericPrev && Number.isFinite(numericPrev) ? numericPrev : null,
      currency,
      billingCycle,
      paymentSource,
      ownerName,
      department,
      seatCount: numericSeats && Number.isFinite(numericSeats) ? numericSeats : null,
    });
    setVendor('');
    setPreviousAmount('');
    setShowAddModal(false);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendor, owner, card..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">All Discovery Sources</option>
            <option value="gmail">Gmail Read-Only</option>
            <option value="outlook">Outlook Read-Only</option>
            <option value="plaid">Plaid Card Feed</option>
            <option value="csv_import">CSV Import</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Subscription
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Discovered Via</th>
                <th className="px-4 py-3">Billed</th>
                <th className="px-4 py-3">Monthly USD</th>
                <th className="px-4 py-3">Next Renewal</th>
                <th className="px-4 py-3">Signals</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No matching subscriptions. Use Zero-Setup Discovery or Add Subscription.
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => {
                  const hike = hikeMap.get(sub.id);
                  const zombies = zombieCountBySub.get(sub.id) ?? 0;
                  const monthlyUsd = toMonthlyUsd(sub.amount, sub.currency, sub.billingCycle);
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => setSelectedSub(sub)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{sub.vendor}</div>
                        <div className="text-xs text-slate-500">
                          {sub.category} · {sub.ownerName} ({sub.department})
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${
                            SOURCE_BADGES[sub.discoverySource] ?? SOURCE_BADGES.manual
                          }`}
                        >
                          {sub.discoverySource.replace('_', ' ')}
                        </span>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {sub.paymentSource}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-900">
                        <div>
                          {formatMoney(sub.amount, sub.currency)}
                          <span className="text-xs text-slate-500">/{sub.billingCycle === 'annual' ? 'yr' : sub.billingCycle === 'quarterly' ? 'qtr' : 'mo'}</span>
                        </div>
                        {sub.seatCount ? (
                          <div className="text-[11px] text-slate-500">{sub.seatCount} seats</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 tabular-nums">
                        {formatMoney(monthlyUsd)}/mo
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums">
                        {sub.nextRenewalDate}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {hike && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              <AlertTriangle className="h-3 w-3" /> +{hike.percentIncrease}% hike
                            </span>
                          )}
                          {zombies > 0 && (
                            <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                              {zombies} zombie{zombies > 1 ? 's' : ''}
                            </span>
                          )}
                          {!hike && zombies === 0 && (
                            <span className="text-xs text-slate-400">Healthy</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            sub.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : sub.status === 'canceling'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Detail Drawer */}
      {liveSelected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30 backdrop-blur-[1px]">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {liveSelected.category} · {liveSelected.discoverySource.toUpperCase()}
                </span>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  {liveSelected.vendor}
                </h3>
                <p className="text-xs text-slate-500">
                  Owner: {liveSelected.ownerName} ({liveSelected.department}) · {liveSelected.paymentSource}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Current Charge</div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {formatMoney(liveSelected.amount, liveSelected.currency)}/{liveSelected.billingCycle}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Next Renewal</div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {liveSelected.nextRenewalDate}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Subscription Status
              </label>
              <div className="flex flex-wrap gap-2">
                {(['active', 'canceling', 'canceled'] as SubscriptionStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={busy}
                    onClick={() => onUpdate(liveSelected.id, { status: st })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize cursor-pointer ${
                      liveSelected.status === st
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Detected Charge &amp; Invoice History
              </h4>
              <div className="mt-2 space-y-2">
                {[...liveSelected.chargeHistory].reverse().map((chg) => (
                  <div
                    key={chg.id}
                    className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
                  >
                    <div>
                      <div className="font-mono font-semibold text-slate-900">{chg.date}</div>
                      <div className="mt-0.5 text-slate-600">{chg.rawDescriptor}</div>
                      {chg.note && <div className="mt-1 text-amber-700 font-medium">{chg.note}</div>}
                    </div>
                    <div className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatMoney(chg.amount, chg.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-4 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await onDelete(liveSelected.id);
                  setSelectedSub(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Add Subscription</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600">Vendor Name</label>
                <input
                  required
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. Retool, Webflow, Jira"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Amount</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Prior (opt.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={previousAmount}
                    onChange={(e) => setPreviousAmount(e.target.value)}
                    placeholder="e.g. 39"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Cycle</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SubscriptionCategory)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Owner</label>
                  <input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Seats (opt.)</label>
                  <input
                    type="number"
                    value={seatCount}
                    onChange={(e) => setSeatCount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Department</label>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Card / Account</label>
                  <input
                    value={paymentSource}
                    onChange={(e) => setPaymentSource(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
                >
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
