import type { BillingCycle, CurrencyCode } from './types';

export const FX_TO_USD: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.28,
  CAD: 0.73,
  AUD: 0.66,
};

export function toUsd(amount: number, currency: CurrencyCode): number {
  const rate = FX_TO_USD[currency] ?? 1;
  return round2(amount * rate);
}

export function toMonthlyAmount(amount: number, cycle: BillingCycle): number {
  if (cycle === 'annual') return round2(amount / 12);
  if (cycle === 'quarterly') return round2(amount / 3);
  return round2(amount);
}

export function toMonthlyUsd(
  amount: number,
  currency: CurrencyCode,
  cycle: BillingCycle
): number {
  return toUsd(toMonthlyAmount(amount, cycle), currency);
}

export function toAnnualUsd(
  amount: number,
  currency: CurrencyCode,
  cycle: BillingCycle
): number {
  return round2(toMonthlyUsd(amount, currency, cycle) * 12);
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
};

export function formatMoney(
  amount: number,
  currency: CurrencyCode = 'USD',
  options?: { decimals?: number }
): string {
  const decimals = options?.decimals ?? (Number.isInteger(amount) ? 0 : 2);
  const symbol = CURRENCY_SYMBOLS[currency] ?? '$';
  const absFormatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return amount < 0 ? `-${symbol}${absFormatted}` : `${symbol}${absFormatted}`;
}

export function normalizeCurrency(raw: string | undefined): CurrencyCode {
  if (!raw) return 'USD';
  const cleaned = raw.trim().toUpperCase();
  if (cleaned === '€' || cleaned === 'EUR') return 'EUR';
  if (cleaned === '£' || cleaned === 'GBP') return 'GBP';
  if (cleaned === 'CAD' || cleaned === 'CA$') return 'CAD';
  if (cleaned === 'AUD' || cleaned === 'A$') return 'AUD';
  return 'USD';
}
