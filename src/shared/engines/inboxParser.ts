import { normalizeCurrency, round2 } from '../currency';
import { matchVendorDescriptor } from '../vendors';
import type { BillingCycle, CurrencyCode, ParsedInvoiceResult } from '../types';
import { computeNextRenewalDate, formatIsoDate } from './dateUtils';

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

function extractDate(text: string, fallbackIso: string): string {
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const namedMatch = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i
  );
  if (namedMatch) {
    const month = MONTH_MAP[namedMatch[1].toLowerCase()] ?? '01';
    const day = namedMatch[2].padStart(2, '0');
    return `${namedMatch[3]}-${month}-${day}`;
  }

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
  }

  return fallbackIso;
}

function extractMoneyCandidates(text: string): {
  amount: number;
  currency: CurrencyCode;
  score: number;
}[] {
  const lines = text.split(/\r?\n/);
  const candidates: { amount: number; currency: CurrencyCode; score: number }[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const regex =
      /(?:(US\$|CA\$|A\$|USD|EUR|GBP|CAD|AUD|\$|€|£)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?))|(?:([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(USD|EUR|GBP|CAD|AUD))/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const sym = match[1] || match[4] || '$';
      const rawNum = (match[2] || match[3] || '0').replace(/,/g, '');
      const amount = Number.parseFloat(rawNum);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      let score = 1;
      if (/(total|amount paid|charged|billed|invoice total|grand total|new total)/i.test(lower)) {
        score += 5;
      }
      if (/(per seat|\/seat|\/user|unit price|each)/i.test(lower)) {
        score -= 3;
      }
      if (/(previous|was \$|old price|prior)/i.test(lower)) {
        score -= 4;
      }

      const normalizedSym = sym.replace(/^US\$/i, 'USD');
      candidates.push({
        amount: round2(amount),
        currency: normalizeCurrency(normalizedSym),
        score,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
}

export function parseInvoiceEmail(
  rawText: string,
  referenceDate = formatIsoDate(new Date())
): ParsedInvoiceResult {
  const trimmed = rawText.trim();
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const subjectLine = lines.find((l) => /^subject:/i.test(l))?.replace(/^subject:\s*/i, '') ?? '';
  const fromLine = lines.find((l) => /^from:/i.test(l))?.replace(/^from:\s*/i, '') ?? '';

  // Prioritize from/subject context for vendor identification
  const vendorProbe = `${fromLine} ${subjectLine} ${trimmed.slice(0, 600)}`;
  const matched = matchVendorDescriptor(vendorProbe);

  const moneyCandidates = extractMoneyCandidates(trimmed);
  const topMoney = moneyCandidates[0] ?? { amount: 29, currency: 'USD' as CurrencyCode, score: 0 };

  let billingCycle: BillingCycle = 'monthly';
  if (/\b(annual|annually|yearly|\/yr|per year|12 months)\b/i.test(trimmed)) {
    billingCycle = 'annual';
  } else if (/\b(quarterly|every 3 months|\/qtr)\b/i.test(trimmed)) {
    billingCycle = 'quarterly';
  }

  const seatMatch = trimmed.match(/(\d{1,4})\s*(?:active\s+)?(?:seats|users|licenses|members)\b/i);
  const seatCount = seatMatch ? Number.parseInt(seatMatch[1], 10) : null;
  const pricePerSeat =
    seatCount && seatCount > 0 ? round2(topMoney.amount / seatCount) : null;

  const chargedDate = extractDate(trimmed, referenceDate);
  const renewalLine = lines.find((l) => /(next billing|renews? on|renewal date)/i.test(l));
  const nextRenewalDate = renewalLine
    ? extractDate(renewalLine, computeNextRenewalDate(chargedDate, billingCycle, referenceDate))
    : computeNextRenewalDate(chargedDate, billingCycle, referenceDate);

  const cardMatch = trimmed.match(/(?:ending in|••|\*\*\*\*|x)\s*(\d{4})\b/i);
  const cardBrandMatch = trimmed.match(/\b(Visa|Mastercard|Amex|American Express|Chase Ink|Mercury|Brex)\b/i);
  const paymentSource = cardMatch
    ? `${cardBrandMatch?.[1] ?? 'Corporate Card'} ••${cardMatch[1]}`
    : 'Primary Card ••4821';

  const hikeCueMatch = trimmed.match(
    /(?:price (?:increase|update|change)|new rate|updated pricing|previously\s+\$?[0-9.,]+)/i
  );
  const explicitHikeNote = hikeCueMatch
    ? `Email mentions pricing change: "${hikeCueMatch[0]}"`
    : null;

  return {
    vendor: matched.vendor,
    normalizedMerchant: matched.normalizedMerchant,
    category: matched.category,
    amount: topMoney.amount,
    currency: topMoney.currency,
    billingCycle,
    chargedDate,
    nextRenewalDate,
    seatCount,
    pricePerSeat,
    paymentSource,
    rawSubjectOrLine: subjectLine || lines[0] || `${matched.vendor} Invoice`,
    confidence: moneyCandidates.length > 0 ? 0.94 : 0.65,
    explicitHikeNote,
  };
}
