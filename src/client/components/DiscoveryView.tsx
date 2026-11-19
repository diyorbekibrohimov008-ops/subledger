import { useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  Mail,
  PlugZap,
  RefreshCw,
  Shield,
  Sparkles,
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
      {/* Zero-Setup Read-Only Connectors */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Zero-Setup Read-Only Connectors
            </h2>
            <p className="text-xs text-slate-500">
              Connect existing inboxes, banks (Plaid), and SSO/Slack in 60 seconds — zero virtual card switch or banking overhaul.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <Shield className="h-3.5 w-3.5" /> Read-Only Scopes Only
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.connectors.map((conn) => (
            <div
              key={conn.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                conn.connected
                  ? 'border-emerald-200 bg-emerald-50/30'
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
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
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
                      'Disconnected'
                    )}
                  </span>
                </div>
                <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                  {conn.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                <div className="text-[11px] text-slate-500">
                  {conn.itemsScanned} scanned · {conn.findingsCount} findings
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
                    Run Sync
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Parser Engines */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Email Receipt Parser */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700">
                <Mail className="h-3.5 w-3.5" /> Inbox Receipt Parser
              </div>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                Test Live Email / Invoice Extraction
              </h3>
              <p className="text-xs text-slate-500">
                Paste any SaaS invoice email — extracts vendor, currency, seats, renewal date &amp; catches stealth hikes against prior invoices.
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
              <option value="gmail">Ingest via Gmail Read-Only</option>
              <option value="outlook">Ingest via Outlook Read-Only</option>
            </select>
            <button
              type="button"
              disabled={busy || !emailText.trim()}
              onClick={() => onScanInbox(emailText, emailSource)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Parse &amp; Ingest Invoice
            </button>
          </div>
        </div>

        {/* Bank / Card CSV & TrackMySubs Migration Parser */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Card Feed &amp; Migration Importer
              </div>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                Import Bank CSV / Plaid Feed / TrackMySubs Export
              </h3>
              <p className="text-xs text-slate-500">
                Normalizes noisy descriptors (`STRIPE *VERCEL`, `CLOUDFLARE*`), infers billing cadence, and compares consecutive charges for stealth hikes.
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
              Sample Bank/Card CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setCsvText(SAMPLE_TRACKMYSUBS_CSV);
                setCsvSource('csv_import');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Sample TrackMySubs Migration CSV
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
              <option value="plaid">Simulate Plaid Read-Only Feed</option>
              <option value="csv_import">Import as CSV / TrackMySubs Migration</option>
            </select>
            <button
              type="button"
              disabled={busy || !csvText.trim()}
              onClick={() => onScanTransactions(csvText, csvSource)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              <PlugZap className="h-3.5 w-3.5" />
              Detect Recurring &amp; Hikes
            </button>
          </div>
        </div>
      </div>

      {/* Zero-Banking-Overhaul Explainer */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex items-center gap-3">
        <Link2 className="h-4 w-4 text-slate-500 shrink-0" />
        <span>
          <strong>How switching works in production:</strong> Connect read-only Gmail/Outlook OAuth or Plaid Link (or set up a dedicated{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-800">
            receipts@yourteam.subledger.app
          </code>{' '}
          forwarding alias) plus Google Workspace SSO &amp; Slack — no virtual debit card issuance or primary bank migration required.
        </span>
      </div>
    </div>
  );
}
