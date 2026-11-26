import { useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  Mail,
  RefreshCw,
  Shield,
  Upload,
} from 'lucide-react';
import {
  SAMPLE_BANK_CSV,
  SAMPLE_INBOX_EMAILS,
  SAMPLE_TRACKMYSUBS_CSV,
} from '../../shared/seedData';
import type { ConnectorId, WorkspaceState } from '../../shared/types';

interface DiscoveryViewProps {
  state: WorkspaceState;
  busy: boolean;
  onToggleConnector: (id: ConnectorId, connected: boolean) => Promise<void>;
  onSyncConnector: (id: ConnectorId) => Promise<void>;
  onScanInbox: (rawText: string, source: 'gmail' | 'outlook') => Promise<void>;
  onScanTransactions: (csvText: string, source: 'csv_import' | 'plaid') => Promise<void>;
}

export function DiscoveryView({
  state,
  busy,
  onToggleConnector,
  onSyncConnector,
  onScanInbox,
  onScanTransactions,
}: DiscoveryViewProps) {
  const [emailText, setEmailText] = useState(SAMPLE_INBOX_EMAILS[0].rawText);
  const [emailSource, setEmailSource] = useState<'gmail' | 'outlook'>('gmail');
  const [csvText, setCsvText] = useState(SAMPLE_BANK_CSV);
  const [csvSource, setCsvSource] = useState<'csv_import' | 'plaid'>('plaid');

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (content) setCsvText(content);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Import bills</h2>
        <p className="text-sm text-slate-500">
          Bring in your software bills automatically by pasting a receipt, uploading a bank CSV, or syncing a read-only account.
        </p>
      </div>

      {/* Paste Receipt & Upload CSV */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Email Receipt Importer */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <Mail className="mt-0.5 h-4 w-4 text-slate-500 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Paste an email receipt
              </h3>
              <p className="text-xs text-slate-500">
                Paste any billing email. SubLedger pulls out the service, amount, renewal date, and checks if the price went up.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_INBOX_EMAILS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setEmailText(sample.rawText)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>

          <textarea
            rows={8}
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-teal-600 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          />

          <div className="flex items-center justify-between gap-2">
            <select
              value={emailSource}
              onChange={(e) => setEmailSource(e.target.value as 'gmail' | 'outlook')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="gmail">From Gmail</option>
              <option value="outlook">From Outlook</option>
            </select>
            <button
              type="button"
              disabled={busy || !emailText.trim()}
              onClick={() => onScanInbox(emailText, emailSource)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              Import receipt
            </button>
          </div>
        </div>

        {/* Bank / Card CSV Importer */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="mt-0.5 h-4 w-4 text-slate-500 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Import a bank or card CSV
              </h3>
              <p className="text-xs text-slate-500">
                Cleans up messy card statement names (like `STRIPE *VERCEL`), groups recurring charges, and flags price increases.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCsvText(SAMPLE_BANK_CSV);
                setCsvSource('plaid');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Sample card CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setCsvText(SAMPLE_TRACKMYSUBS_CSV);
                setCsvSource('csv_import');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Sample TrackMySubs CSV
            </button>
            <label className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Upload className="h-3 w-3" />
              Upload .CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-teal-600 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          />

          <div className="flex items-center justify-between gap-2">
            <select
              value={csvSource}
              onChange={(e) => setCsvSource(e.target.value as 'csv_import' | 'plaid')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="plaid">Bank or card feed</option>
              <option value="csv_import">CSV / TrackMySubs export</option>
            </select>
            <button
              type="button"
              disabled={busy || !csvText.trim()}
              onClick={() => onScanTransactions(csvText, csvSource)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              Import CSV
            </button>
          </div>
        </div>
      </div>

      {/* Connected Read-Only Accounts */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Connected accounts (read-only)
            </h3>
            <p className="text-xs text-slate-500">
              Works alongside your existing email, cards, and team directory — no bank switch required.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <Shield className="h-3.5 w-3.5" /> Read-only access
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.connectors.map((conn) => (
            <div
              key={conn.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                conn.connected
                  ? 'border-emerald-200 bg-emerald-50/25'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{conn.name}</div>
                    <div className="mt-0.5 text-xs font-mono text-slate-500">
                      {conn.accountLabel}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      conn.connected
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {conn.connected ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </>
                    ) : (
                      'Not connected'
                    )}
                  </span>
                </div>
                <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                  {conn.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                <div className="text-[11px] text-slate-500">
                  {conn.itemsScanned} checked · {conn.findingsCount} found
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleConnector(conn.id, !conn.connected)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {conn.connected ? 'Disconnect' : 'Connect'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSyncConnector(conn.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Sync
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
