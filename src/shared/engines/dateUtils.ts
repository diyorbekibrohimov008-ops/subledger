import type { BillingCycle } from '../types';

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
}

export function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffDays(earlierIso: string, laterIso: string): number {
  const a = parseIsoDate(earlierIso).getTime();
  const b = parseIsoDate(laterIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIsoDate(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseIsoDate(iso);
  const originalDay = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== originalDay) {
    d.setUTCDate(0);
  }
  return formatIsoDate(d);
}

export function computeNextRenewalDate(
  lastChargedIso: string,
  cycle: BillingCycle,
  referenceIso: string
): string {
  const stepMonths = cycle === 'annual' ? 12 : cycle === 'quarterly' ? 3 : 1;
  let candidate = addMonths(lastChargedIso, stepMonths);
  let guard = 0;
  while (candidate < referenceIso && guard < 36) {
    candidate = addMonths(candidate, stepMonths);
    guard += 1;
  }
  return candidate;
}

export function maxIsoDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}
