// api/index.ts
import fs2 from "node:fs";
import path2 from "node:path";
import { gunzipSync } from "node:zlib";

// src/server/app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

// src/shared/currency.ts
var FX_TO_USD = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.28,
  CAD: 0.73,
  AUD: 0.66
};
function toUsd(amount, currency) {
  const rate = FX_TO_USD[currency] ?? 1;
  return round2(amount * rate);
}
function toMonthlyAmount(amount, cycle) {
  if (cycle === "annual") return round2(amount / 12);
  if (cycle === "quarterly") return round2(amount / 3);
  return round2(amount);
}
function toMonthlyUsd(amount, currency, cycle) {
  return toUsd(toMonthlyAmount(amount, cycle), currency);
}
function toAnnualUsd(amount, currency, cycle) {
  return round2(toMonthlyUsd(amount, currency, cycle) * 12);
}
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function normalizeCurrency(raw) {
  if (!raw) return "USD";
  const cleaned = raw.trim().toUpperCase();
  if (cleaned === "\u20AC" || cleaned === "EUR") return "EUR";
  if (cleaned === "\xA3" || cleaned === "GBP") return "GBP";
  if (cleaned === "CAD" || cleaned === "CA$") return "CAD";
  if (cleaned === "AUD" || cleaned === "A$") return "AUD";
  return "USD";
}

// src/shared/engines/dateUtils.ts
function parseIsoDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
}
function formatIsoDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function diffDays(earlierIso, laterIso) {
  const a = parseIsoDate(earlierIso).getTime();
  const b = parseIsoDate(laterIso).getTime();
  return Math.round((b - a) / 864e5);
}
function addMonths(iso, months) {
  const d = parseIsoDate(iso);
  const originalDay = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== originalDay) {
    d.setUTCDate(0);
  }
  return formatIsoDate(d);
}
function computeNextRenewalDate(lastChargedIso, cycle, referenceIso) {
  const stepMonths = cycle === "annual" ? 12 : cycle === "quarterly" ? 3 : 1;
  let candidate = addMonths(lastChargedIso, stepMonths);
  let guard = 0;
  while (candidate < referenceIso && guard < 36) {
    candidate = addMonths(candidate, stepMonths);
    guard += 1;
  }
  return candidate;
}
function maxIsoDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

// src/shared/vendors.ts
var VENDOR_CATALOG = [
  {
    normalizedMerchant: "figma",
    vendor: "Figma",
    category: "Design",
    keywords: ["figma"],
    domains: ["figma.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "slack",
    vendor: "Slack",
    category: "Collaboration",
    keywords: ["slack", "slack technologies"],
    domains: ["slack.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "notion",
    vendor: "Notion",
    category: "Collaboration",
    keywords: ["notion", "notion labs"],
    domains: ["notion.so", "makenotion.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "linear",
    vendor: "Linear",
    category: "AI & Dev",
    keywords: ["linear.app", "linear orbit", "linear"],
    domains: ["linear.app"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "github",
    vendor: "GitHub",
    category: "AI & Dev",
    keywords: ["github", "github copilot"],
    domains: ["github.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "openai",
    vendor: "OpenAI",
    category: "AI & Dev",
    keywords: ["openai", "chatgpt"],
    domains: ["openai.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "anthropic",
    vendor: "Anthropic",
    category: "AI & Dev",
    keywords: ["anthropic", "claude"],
    domains: ["anthropic.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "vercel",
    vendor: "Vercel",
    category: "Infrastructure",
    keywords: ["vercel"],
    domains: ["vercel.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "aws",
    vendor: "AWS",
    category: "Infrastructure",
    keywords: ["amazon web services", "aws"],
    domains: ["amazonaws.com", "aws.amazon.com"]
  },
  {
    normalizedMerchant: "hubspot",
    vendor: "HubSpot",
    category: "CRM & Sales",
    keywords: ["hubspot"],
    domains: ["hubspot.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "loom",
    vendor: "Loom",
    category: "Collaboration",
    keywords: ["loom.com", "loom inc", "loom"],
    domains: ["loom.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "zoom",
    vendor: "Zoom",
    category: "Collaboration",
    keywords: ["zoom.us", "zoom video", "zoom"],
    domains: ["zoom.us", "zoom.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "1password",
    vendor: "1Password",
    category: "Security",
    keywords: ["1password", "agilebits"],
    domains: ["1password.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "adobe",
    vendor: "Adobe Creative Cloud",
    category: "Design",
    keywords: ["adobe"],
    domains: ["adobe.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "datadog",
    vendor: "Datadog",
    category: "Infrastructure",
    keywords: ["datadog"],
    domains: ["datadoghq.com"]
  },
  {
    normalizedMerchant: "sentry",
    vendor: "Sentry",
    category: "AI & Dev",
    keywords: ["sentry", "functional software"],
    domains: ["sentry.io"]
  },
  {
    normalizedMerchant: "intercom",
    vendor: "Intercom",
    category: "CRM & Sales",
    keywords: ["intercom"],
    domains: ["intercom.com", "intercom.io"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "asana",
    vendor: "Asana",
    category: "Collaboration",
    keywords: ["asana"],
    domains: ["asana.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "airtable",
    vendor: "Airtable",
    category: "Collaboration",
    keywords: ["airtable"],
    domains: ["airtable.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "webflow",
    vendor: "Webflow",
    category: "Design",
    keywords: ["webflow"],
    domains: ["webflow.com"]
  },
  {
    normalizedMerchant: "canva",
    vendor: "Canva Teams",
    category: "Design",
    keywords: ["canva"],
    domains: ["canva.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "docusign",
    vendor: "DocuSign",
    category: "Finance & Ops",
    keywords: ["docusign"],
    domains: ["docusign.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "gusto",
    vendor: "Gusto",
    category: "Finance & Ops",
    keywords: ["gusto"],
    domains: ["gusto.com"]
  },
  {
    normalizedMerchant: "cloudflare",
    vendor: "Cloudflare",
    category: "Infrastructure",
    keywords: ["cloudflare"],
    domains: ["cloudflare.com"]
  },
  {
    normalizedMerchant: "supabase",
    vendor: "Supabase",
    category: "Infrastructure",
    keywords: ["supabase"],
    domains: ["supabase.com", "supabase.io"]
  },
  {
    normalizedMerchant: "posthog",
    vendor: "PostHog",
    category: "AI & Dev",
    keywords: ["posthog"],
    domains: ["posthog.com"]
  },
  {
    normalizedMerchant: "miro",
    vendor: "Miro",
    category: "Collaboration",
    keywords: ["miro", "realtimeboard"],
    domains: ["miro.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "atlassian",
    vendor: "Jira / Atlassian",
    category: "AI & Dev",
    keywords: ["atlassian", "jira", "confluence"],
    domains: ["atlassian.com"],
    perSeatLikely: true
  },
  {
    normalizedMerchant: "quickbooks",
    vendor: "QuickBooks Online",
    category: "Finance & Ops",
    keywords: ["quickbooks", "intuit"],
    domains: ["intuit.com"]
  },
  {
    normalizedMerchant: "calendly",
    vendor: "Calendly",
    category: "CRM & Sales",
    keywords: ["calendly"],
    domains: ["calendly.com"],
    perSeatLikely: true
  }
];
function matchVendorDescriptor(rawText) {
  const lower = rawText.toLowerCase();
  for (const entry of VENDOR_CATALOG) {
    if (entry.domains.some((d) => lower.includes(d))) {
      return {
        normalizedMerchant: entry.normalizedMerchant,
        vendor: entry.vendor,
        category: entry.category
      };
    }
    if (entry.keywords.some((k) => lower.includes(k))) {
      return {
        normalizedMerchant: entry.normalizedMerchant,
        vendor: entry.vendor,
        category: entry.category
      };
    }
  }
  const cleaned = rawText.replace(/^(SQ \*|STRIPE \*|PAYPAL \*|TST\*|PP\*|SP )/i, "").replace(/\b(INC|LLC|LTD|CORP|CO|SAN FRAN|SF|CA|US|USA|BILLING)\b/gi, "").replace(/[#*0-9-]+/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const vendor = words.length > 0 ? words.join(" ") : "Unknown SaaS";
  const normalizedMerchant = vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    normalizedMerchant: normalizedMerchant || "unknown-saas",
    vendor,
    category: "Other"
  };
}

// src/shared/engines/inboxParser.ts
var MONTH_MAP = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12"
};
function extractDate(text, fallbackIso) {
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];
  const namedMatch = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i
  );
  if (namedMatch) {
    const month = MONTH_MAP[namedMatch[1].toLowerCase()] ?? "01";
    const day = namedMatch[2].padStart(2, "0");
    return `${namedMatch[3]}-${month}-${day}`;
  }
  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
  }
  return fallbackIso;
}
function extractMoneyCandidates(text) {
  const lines = text.split(/\r?\n/);
  const candidates = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    const regex = /(?:(US\$|CA\$|A\$|USD|EUR|GBP|CAD|AUD|\$|€|£)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?))|(?:([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(USD|EUR|GBP|CAD|AUD))/gi;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const sym = match[1] || match[4] || "$";
      const rawNum = (match[2] || match[3] || "0").replace(/,/g, "");
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
      const normalizedSym = sym.replace(/^US\$/i, "USD");
      candidates.push({
        amount: round2(amount),
        currency: normalizeCurrency(normalizedSym),
        score
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
}
function parseInvoiceEmail(rawText, referenceDate = formatIsoDate(/* @__PURE__ */ new Date())) {
  const trimmed = rawText.trim();
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const subjectLine = lines.find((l) => /^subject:/i.test(l))?.replace(/^subject:\s*/i, "") ?? "";
  const fromLine = lines.find((l) => /^from:/i.test(l))?.replace(/^from:\s*/i, "") ?? "";
  const vendorProbe = `${fromLine} ${subjectLine} ${trimmed.slice(0, 600)}`;
  const matched = matchVendorDescriptor(vendorProbe);
  const moneyCandidates = extractMoneyCandidates(trimmed);
  const topMoney = moneyCandidates[0] ?? { amount: 29, currency: "USD", score: 0 };
  let billingCycle = "monthly";
  if (/\b(annual|annually|yearly|\/yr|per year|12 months)\b/i.test(trimmed)) {
    billingCycle = "annual";
  } else if (/\b(quarterly|every 3 months|\/qtr)\b/i.test(trimmed)) {
    billingCycle = "quarterly";
  }
  const seatMatch = trimmed.match(/(\d{1,4})\s*(?:active\s+)?(?:seats|users|licenses|members)\b/i);
  const seatCount = seatMatch ? Number.parseInt(seatMatch[1], 10) : null;
  const pricePerSeat = seatCount && seatCount > 0 ? round2(topMoney.amount / seatCount) : null;
  const chargedDate = extractDate(trimmed, referenceDate);
  const renewalLine = lines.find((l) => /(next billing|renews? on|renewal date)/i.test(l));
  const nextRenewalDate = renewalLine ? extractDate(renewalLine, computeNextRenewalDate(chargedDate, billingCycle, referenceDate)) : computeNextRenewalDate(chargedDate, billingCycle, referenceDate);
  const cardMatch = trimmed.match(/(?:ending in|••|\*\*\*\*|x)\s*(\d{4})\b/i);
  const cardBrandMatch = trimmed.match(/\b(Visa|Mastercard|Amex|American Express|Chase Ink|Mercury|Brex)\b/i);
  const paymentSource = cardMatch ? `${cardBrandMatch?.[1] ?? "Corporate Card"} \u2022\u2022${cardMatch[1]}` : "Primary Card \u2022\u20224821";
  const hikeCueMatch = trimmed.match(
    /(?:price (?:increase|update|change)|new rate|updated pricing|previously\s+\$?[0-9.,]+)/i
  );
  const explicitHikeNote = hikeCueMatch ? `Email mentions pricing change: "${hikeCueMatch[0]}"` : null;
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
    explicitHikeNote
  };
}

// src/shared/engines/transactionDetector.ts
function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}
function normalizeDateCell(raw) {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }
  return null;
}
function parseBankCsv(csvText, defaultSourceLabel = "Bank CSV Import") {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const descIdx = headers.findIndex(
    (h) => h.includes("desc") || h.includes("merchant") || h.includes("vendor") || h.includes("name")
  );
  const amountIdx = headers.findIndex((h) => h === "amount" || h.includes("debit") || h.includes("price"));
  const currencyIdx = headers.findIndex((h) => h.includes("curr"));
  const cardIdx = headers.findIndex((h) => h.includes("card") || h.includes("account") || h.includes("source"));
  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    return [];
  }
  const parsed = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const date = normalizeDateCell(cols[dateIdx] ?? "");
    const rawDescriptor = cols[descIdx] ?? "";
    const rawAmountStr = (cols[amountIdx] ?? "").replace(/(?:US\$|CA\$|A\$)|[€£$,\s]/gi, "");
    const numeric = Number.parseFloat(rawAmountStr);
    if (!date || !rawDescriptor || !Number.isFinite(numeric) || numeric === 0) {
      continue;
    }
    const amount = round2(Math.abs(numeric));
    const rawCurrCell = currencyIdx >= 0 ? cols[currencyIdx] : void 0;
    const inferredCurrency = rawCurrCell ? normalizeCurrency(rawCurrCell) : (cols[amountIdx] ?? "").includes("\u20AC") ? "EUR" : (cols[amountIdx] ?? "").includes("\xA3") ? "GBP" : "USD";
    const matched = matchVendorDescriptor(rawDescriptor);
    parsed.push({
      date,
      rawDescriptor,
      normalizedMerchant: matched.normalizedMerchant,
      vendor: matched.vendor,
      category: matched.category,
      amount,
      currency: inferredCurrency,
      paymentSource: cardIdx >= 0 && cols[cardIdx] ? cols[cardIdx] : defaultSourceLabel
    });
  }
  return parsed.sort((a, b) => a.date.localeCompare(b.date));
}
function inferBillingCycle(dates) {
  if (dates.length < 2) return "monthly";
  const sorted = [...dates].sort();
  const intervals = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = diffDays(sorted[i - 1], sorted[i]);
    if (gap > 0) intervals.push(gap);
  }
  if (intervals.length === 0) return "monthly";
  const avg = intervals.reduce((s, n) => s + n, 0) / intervals.length;
  if (avg >= 320) return "annual";
  if (avg >= 75) return "quarterly";
  return "monthly";
}
function classifyPriceHike(percentIncrease, currencyChanged = false) {
  if (currencyChanged) return "fx_drift";
  if (percentIncrease >= 40) return "promo_expiry";
  if (percentIncrease >= 20) return "tier_creep";
  return "stealth_unit_hike";
}
function detectHikeFromChargePair(params) {
  const { subscription, previousCharge, latestCharge, thresholdPct, source } = params;
  if (latestCharge.amount <= previousCharge.amount || previousCharge.amount <= 0) {
    return null;
  }
  const pct = round2(
    (latestCharge.amount - previousCharge.amount) / previousCharge.amount * 100
  );
  if (pct < thresholdPct) return null;
  const prevMonthlyUsd = toMonthlyUsd(
    previousCharge.amount,
    previousCharge.currency,
    subscription.billingCycle
  );
  const nextMonthlyUsd = toMonthlyUsd(
    latestCharge.amount,
    latestCharge.currency,
    subscription.billingCycle
  );
  const monthlyImpactUsd = round2(Math.max(0, nextMonthlyUsd - prevMonthlyUsd));
  const annualImpactUsd = round2(
    Math.max(
      0,
      toAnnualUsd(latestCharge.amount, latestCharge.currency, subscription.billingCycle) - toAnnualUsd(previousCharge.amount, previousCharge.currency, subscription.billingCycle)
    )
  );
  return {
    id: `hike-${subscription.normalizedMerchant}-${latestCharge.date}`,
    subscriptionId: subscription.id,
    vendor: subscription.vendor,
    detectedAt: latestCharge.date,
    previousAmount: previousCharge.amount,
    newAmount: latestCharge.amount,
    currency: latestCharge.currency,
    percentIncrease: pct,
    monthlyImpactUsd,
    annualImpactUsd,
    hikeType: classifyPriceHike(pct, previousCharge.currency !== latestCharge.currency),
    evidence: `${latestCharge.date} charge (${latestCharge.amount.toFixed(2)} ${latestCharge.currency}) vs prior ${previousCharge.date} (${previousCharge.amount.toFixed(2)} ${previousCharge.currency}) via ${source.toUpperCase()}`,
    source,
    status: "open"
  };
}
function ingestTransactionsIntoWorkspace(state, transactions, source) {
  const nextSubs = state.subscriptions.map((s) => ({
    ...s,
    chargeHistory: [...s.chargeHistory]
  }));
  const nextHikes = [...state.priceHikes];
  const detectedHikes = [];
  const grouped = /* @__PURE__ */ new Map();
  for (const tx of transactions) {
    const list = grouped.get(tx.normalizedMerchant) ?? [];
    list.push(tx);
    grouped.set(tx.normalizedMerchant, list);
  }
  let subscriptionsAdded = 0;
  let subscriptionsUpdated = 0;
  for (const [merchantKey, group] of grouped.entries()) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    let sub = nextSubs.find((s) => s.normalizedMerchant === merchantKey);
    if (!sub) {
      const cycle = inferBillingCycle(sorted.map((t) => t.date));
      const latest = sorted[sorted.length - 1];
      const prior = sorted.length > 1 ? sorted[sorted.length - 2] : null;
      sub = {
        id: `sub-${merchantKey}`,
        vendor: latest.vendor,
        normalizedMerchant: merchantKey,
        category: latest.category,
        billingCycle: cycle,
        currency: latest.currency,
        amount: latest.amount,
        previousAmount: prior ? prior.amount : null,
        nextRenewalDate: computeNextRenewalDate(
          latest.date,
          cycle,
          state.settings.referenceDate
        ),
        lastChargedDate: latest.date,
        paymentSource: latest.paymentSource,
        discoverySource: source,
        status: "active",
        ownerName: "Auto-Discovered",
        ownerEmail: "finance@company.io",
        department: "Operations",
        seatCount: null,
        pricePerSeat: null,
        autoRenewNoticeDays: cycle === "annual" ? 30 : 7,
        chargeHistory: sorted.map((t, idx) => ({
          id: `chg-${merchantKey}-${t.date}-${idx}`,
          date: t.date,
          amount: t.amount,
          currency: t.currency,
          source,
          rawDescriptor: t.rawDescriptor
        }))
      };
      nextSubs.push(sub);
      subscriptionsAdded += 1;
      if (sorted.length >= 2) {
        const len = sub.chargeHistory.length;
        const alert = detectHikeFromChargePair({
          subscription: sub,
          previousCharge: sub.chargeHistory[len - 2],
          latestCharge: sub.chargeHistory[len - 1],
          thresholdPct: state.settings.priceHikeThresholdPct,
          source
        });
        if (alert && !nextHikes.some((h) => h.id === alert.id)) {
          nextHikes.unshift(alert);
          detectedHikes.push(alert);
        }
      }
    } else {
      let touched = false;
      for (const tx of sorted) {
        const duplicate = sub.chargeHistory.some(
          (c) => c.date === tx.date && Math.abs(c.amount - tx.amount) < 0.01
        );
        if (!duplicate) {
          sub.chargeHistory.push({
            id: `chg-${merchantKey}-${tx.date}-${sub.chargeHistory.length}`,
            date: tx.date,
            amount: tx.amount,
            currency: tx.currency,
            source,
            rawDescriptor: tx.rawDescriptor
          });
          touched = true;
        }
      }
      if (touched) {
        sub.chargeHistory.sort((a, b) => a.date.localeCompare(b.date));
        const len = sub.chargeHistory.length;
        const latestCharge = sub.chargeHistory[len - 1];
        const prevCharge = len >= 2 ? sub.chargeHistory[len - 2] : null;
        sub.previousAmount = prevCharge ? prevCharge.amount : sub.previousAmount;
        sub.amount = latestCharge.amount;
        sub.currency = latestCharge.currency;
        sub.lastChargedDate = latestCharge.date;
        sub.nextRenewalDate = computeNextRenewalDate(
          latestCharge.date,
          sub.billingCycle,
          state.settings.referenceDate
        );
        subscriptionsUpdated += 1;
        if (prevCharge) {
          const alert = detectHikeFromChargePair({
            subscription: sub,
            previousCharge: prevCharge,
            latestCharge,
            thresholdPct: state.settings.priceHikeThresholdPct,
            source
          });
          if (alert && !nextHikes.some((h) => h.id === alert.id)) {
            nextHikes.unshift(alert);
            detectedHikes.push(alert);
          }
        }
      }
    }
  }
  return {
    nextState: {
      ...state,
      subscriptions: nextSubs,
      priceHikes: nextHikes,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    subscriptionsAdded,
    subscriptionsUpdated,
    hikesDetected: detectedHikes
  };
}
function ingestParsedInvoiceIntoWorkspace(state, invoice, source) {
  const nextSubs = state.subscriptions.map((s) => ({
    ...s,
    chargeHistory: [...s.chargeHistory]
  }));
  const nextHikes = [...state.priceHikes];
  let sub = nextSubs.find((s) => s.normalizedMerchant === invoice.normalizedMerchant);
  let created = false;
  let hikeDetected = null;
  const newCharge = {
    id: `chg-${invoice.normalizedMerchant}-${invoice.chargedDate}-${Date.now().toString(36)}`,
    date: invoice.chargedDate,
    amount: invoice.amount,
    currency: invoice.currency,
    source,
    rawDescriptor: invoice.rawSubjectOrLine,
    note: invoice.explicitHikeNote ?? void 0
  };
  if (!sub) {
    created = true;
    sub = {
      id: `sub-${invoice.normalizedMerchant}`,
      vendor: invoice.vendor,
      normalizedMerchant: invoice.normalizedMerchant,
      category: invoice.category,
      billingCycle: invoice.billingCycle,
      currency: invoice.currency,
      amount: invoice.amount,
      previousAmount: null,
      nextRenewalDate: invoice.nextRenewalDate,
      lastChargedDate: invoice.chargedDate,
      paymentSource: invoice.paymentSource,
      discoverySource: source,
      status: "active",
      ownerName: "Inbox Auto-Discovery",
      ownerEmail: "finance@company.io",
      department: "General",
      seatCount: invoice.seatCount,
      pricePerSeat: invoice.pricePerSeat,
      autoRenewNoticeDays: invoice.billingCycle === "annual" ? 30 : 7,
      chargeHistory: [newCharge]
    };
    nextSubs.unshift(sub);
  } else {
    const prevAmount = sub.amount;
    const prevCharge = sub.chargeHistory[sub.chargeHistory.length - 1] ?? {
      id: `chg-prev-${sub.id}`,
      date: sub.lastChargedDate,
      amount: prevAmount,
      currency: sub.currency,
      source: sub.discoverySource,
      rawDescriptor: sub.vendor
    };
    const duplicate = sub.chargeHistory.some(
      (c) => c.date === newCharge.date && Math.abs(c.amount - newCharge.amount) < 0.01
    );
    if (!duplicate) {
      sub.chargeHistory.push(newCharge);
      sub.chargeHistory.sort((a, b) => a.date.localeCompare(b.date));
    }
    sub.previousAmount = prevAmount;
    sub.amount = invoice.amount;
    sub.currency = invoice.currency;
    sub.billingCycle = invoice.billingCycle;
    sub.lastChargedDate = invoice.chargedDate;
    sub.nextRenewalDate = invoice.nextRenewalDate;
    sub.paymentSource = invoice.paymentSource;
    if (invoice.seatCount !== null) sub.seatCount = invoice.seatCount;
    if (invoice.pricePerSeat !== null) sub.pricePerSeat = invoice.pricePerSeat;
    const alert = detectHikeFromChargePair({
      subscription: sub,
      previousCharge: prevCharge,
      latestCharge: newCharge,
      thresholdPct: state.settings.priceHikeThresholdPct,
      source
    });
    if (alert && !nextHikes.some((h) => h.id === alert.id)) {
      nextHikes.unshift(alert);
      hikeDetected = alert;
    }
  }
  return {
    nextState: {
      ...state,
      subscriptions: nextSubs,
      priceHikes: nextHikes,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    subscription: sub,
    hikeDetected,
    created
  };
}

// src/shared/engines/zombieDetector.ts
function evaluateZombieSeat(seat, thresholdDays, referenceDate) {
  const lastAppActivityAt = maxIsoDate(seat.lastSsoLoginAt, seat.lastSlackActiveAt);
  const daysInactive = lastAppActivityAt ? Math.max(0, diffDays(lastAppActivityAt, referenceDate)) : 90;
  let status = seat.status;
  if (status !== "reclaimed" && status !== "exempt" && status !== "nudge_sent" && status !== "reclaim_scheduled") {
    if (seat.employmentStatus === "offboarded" || daysInactive >= thresholdDays) {
      status = "flagged";
    }
  }
  return {
    ...seat,
    lastAppActivityAt,
    daysInactive,
    status
  };
}
function reevaluateWorkspaceZombies(state, thresholdDays = state.settings.zombieThresholdDays) {
  const nextSeats = state.zombieSeats.map((seat) => {
    const lastAppActivityAt = maxIsoDate(seat.lastSsoLoginAt, seat.lastSlackActiveAt);
    const daysInactive = lastAppActivityAt ? Math.max(0, diffDays(lastAppActivityAt, state.settings.referenceDate)) : 90;
    return {
      ...seat,
      lastAppActivityAt,
      daysInactive
    };
  });
  return {
    ...state,
    settings: {
      ...state.settings,
      zombieThresholdDays: thresholdDays
    },
    zombieSeats: nextSeats,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function getActiveFlaggedZombies(state) {
  const threshold = state.settings.zombieThresholdDays;
  return state.zombieSeats.filter(
    (s) => s.status !== "reclaimed" && s.status !== "exempt" && (s.employmentStatus === "offboarded" || s.daysInactive >= threshold)
  );
}
function parseSeatActivityCsv(csvText, state) {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name) => headers.findIndex((h) => h.includes(name));
  const vendorIdx = idx("vendor") !== -1 ? idx("vendor") : idx("app");
  const nameIdx = idx("name");
  const emailIdx = idx("email");
  const deptIdx = idx("dept") !== -1 ? idx("dept") : idx("department");
  const costIdx = idx("cost") !== -1 ? idx("cost") : idx("price");
  const ssoIdx = idx("sso");
  const slackIdx = idx("slack");
  const empIdx = idx("employment") !== -1 ? idx("employment") : idx("status");
  if (vendorIdx === -1 || emailIdx === -1) return [];
  const results = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const vendor = cols[vendorIdx];
    const employeeEmail = cols[emailIdx];
    if (!vendor || !employeeEmail) continue;
    const employeeName = nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : employeeEmail.split("@")[0];
    const department = deptIdx >= 0 && cols[deptIdx] ? cols[deptIdx] : "Operations";
    const rawSeatCost = costIdx >= 0 ? (cols[costIdx] ?? "").replace(/(?:US\$|CA\$|A\$)|[€£$,\s]/gi, "") : "";
    const parsedSeatCost = rawSeatCost ? Number.parseFloat(rawSeatCost) : Number.NaN;
    const seatCost = Number.isFinite(parsedSeatCost) && parsedSeatCost > 0 ? parsedSeatCost : 15;
    const lastSsoLoginAt = ssoIdx >= 0 && cols[ssoIdx] ? cols[ssoIdx].slice(0, 10) : null;
    const lastSlackActiveAt = slackIdx >= 0 && cols[slackIdx] ? cols[slackIdx].slice(0, 10) : null;
    const employmentStatus = empIdx >= 0 && cols[empIdx] && /offboard|former|terminated|inactive/i.test(cols[empIdx]) ? "offboarded" : "active";
    const matchedSub = state.subscriptions.find(
      (s) => s.vendor.toLowerCase() === vendor.toLowerCase()
    );
    results.push(
      evaluateZombieSeat(
        {
          id: `seat-${vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${employeeEmail.replace(/[^a-z0-9]+/gi, "-")}`,
          subscriptionId: matchedSub?.id ?? `sub-${vendor.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          vendor: matchedSub?.vendor ?? vendor,
          employeeName,
          employeeEmail,
          department,
          employmentStatus,
          seatCostMonthlyUsd: round2(seatCost),
          lastSsoLoginAt,
          lastSlackActiveAt,
          activitySource: lastSsoLoginAt && lastSlackActiveAt ? "both" : lastSlackActiveAt ? "slack" : "google_workspace_sso",
          status: "flagged"
        },
        state.settings.zombieThresholdDays,
        state.settings.referenceDate
      )
    );
  }
  return results;
}
function computeWorkspaceMetrics(state) {
  const activeSubs = state.subscriptions.filter(
    (s) => s.status === "active" || s.status === "trial" || s.status === "canceling"
  );
  const monthlySpendUsd = round2(
    activeSubs.reduce(
      (sum, s) => sum + toMonthlyUsd(s.amount, s.currency, s.billingCycle),
      0
    )
  );
  const annualSpendUsd = round2(monthlySpendUsd * 12);
  const openHikes = state.priceHikes.filter(
    (h) => h.status === "open" || h.status === "disputing"
  );
  const annualHikeImpactUsd = round2(
    openHikes.reduce((sum, h) => sum + h.annualImpactUsd, 0)
  );
  const flaggedZombies = getActiveFlaggedZombies(state);
  const offboardedZombieCount = flaggedZombies.filter(
    (z) => z.employmentStatus === "offboarded"
  ).length;
  const monthlyZombieWasteUsd = round2(
    flaggedZombies.reduce((sum, z) => sum + z.seatCostMonthlyUsd, 0)
  );
  const annualZombieWasteUsd = round2(monthlyZombieWasteUsd * 12);
  const reclaimedSeats = state.zombieSeats.filter((z) => z.status === "reclaimed");
  const reclaimedMonthlySavingsUsd = round2(
    reclaimedSeats.reduce((sum, z) => sum + z.seatCostMonthlyUsd, 0)
  );
  const reclaimedAnnualSavingsUsd = round2(reclaimedMonthlySavingsUsd * 12);
  const upcoming = activeSubs.filter((s) => {
    const d = diffDays(state.settings.referenceDate, s.nextRenewalDate);
    return d >= 0 && d <= state.settings.renewalNoticeWindowDays;
  });
  const upcomingRenewals14dUsd = round2(
    upcoming.reduce((sum, s) => sum + toMonthlyUsd(s.amount, s.currency, s.billingCycle), 0)
  );
  const planPriceMonthlyUsd = 0;
  const cledaraMonthlyBaselineUsd = 175;
  const totalMonthlyDetectedValue = monthlyZombieWasteUsd + reclaimedMonthlySavingsUsd + round2(annualHikeImpactUsd / 12);
  const netPaybackMultiple = planPriceMonthlyUsd > 0 ? round2(totalMonthlyDetectedValue / planPriceMonthlyUsd) : 0;
  return {
    activeSubscriptionCount: activeSubs.length,
    monthlySpendUsd,
    annualSpendUsd,
    openHikeCount: openHikes.length,
    annualHikeImpactUsd,
    flaggedZombieCount: flaggedZombies.length,
    offboardedZombieCount,
    monthlyZombieWasteUsd,
    annualZombieWasteUsd,
    reclaimedMonthlySavingsUsd,
    reclaimedAnnualSavingsUsd,
    upcomingRenewals14dCount: upcoming.length,
    upcomingRenewals14dUsd,
    planPriceMonthlyUsd,
    cledaraMonthlyBaselineUsd,
    netPaybackMultiple
  };
}

// src/shared/seedData.ts
var REFERENCE_TODAY = "2026-11-11";
function createEmptyWorkspaceState(companyName = "My Company") {
  return {
    settings: {
      companyName,
      planTier: "free",
      zombieThresholdDays: 30,
      priceHikeThresholdPct: 3,
      renewalNoticeWindowDays: 14,
      referenceDate: REFERENCE_TODAY
    },
    connectors: [
      {
        id: "gmail",
        name: "Gmail (Read-Only)",
        category: "inbox",
        mode: "read_only",
        connected: false,
        accountLabel: "Not connected",
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: "Scans receipts & renewal emails via gmail.readonly without touching outgoing mail."
      },
      {
        id: "outlook",
        name: "Microsoft Outlook (Read-Only)",
        category: "inbox",
        mode: "read_only",
        connected: false,
        accountLabel: "Not connected",
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: "Detects SaaS PDFs & billing notices from Microsoft 365 mailboxes."
      },
      {
        id: "plaid",
        name: "Plaid Bank & Card Feed",
        category: "banking",
        mode: "read_only",
        connected: false,
        accountLabel: "Not connected",
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: "Reads existing corporate cards & checking accounts \u2014 zero virtual card switch."
      },
      {
        id: "google_workspace",
        name: "Google Workspace SSO",
        category: "identity",
        mode: "read_only",
        connected: false,
        accountLabel: "Not connected",
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: "Flags paid SaaS seats with 30+ days since last SSO sign-in or offboarded staff."
      },
      {
        id: "slack",
        name: "Slack Workspace Activity",
        category: "identity",
        mode: "read_only",
        connected: false,
        accountLabel: "Not connected",
        lastSyncedAt: null,
        itemsScanned: 0,
        findingsCount: 0,
        description: "Cross-checks Slack active status & sends 1-click seat check-ins before reclaiming."
      }
    ],
    subscriptions: [],
    priceHikes: [],
    zombieSeats: [],
    logs: [
      {
        id: "log-init-empty",
        timestamp: `${REFERENCE_TODAY}T10:00:00Z`,
        kind: "connector_sync",
        summary: "Clean workspace created. Connect a read-only feed or paste a receipt/CSV to discover subscriptions automatically.",
        subscriptionsTouched: 0,
        hikesDetected: 0,
        zombiesFlagged: 0
      }
    ],
    updatedAt: `${REFERENCE_TODAY}T10:00:00Z`
  };
}
function createDemoWorkspaceState() {
  const subscriptions = [
    {
      id: "sub-figma",
      vendor: "Figma",
      normalizedMerchant: "figma",
      category: "Design",
      billingCycle: "monthly",
      currency: "USD",
      amount: 270,
      previousAmount: 216,
      nextRenewalDate: "2026-11-18",
      lastChargedDate: "2026-10-18",
      paymentSource: "Chase Ink \u2022\u20224821",
      discoverySource: "gmail",
      status: "active",
      ownerName: "Maya Lin",
      ownerEmail: "maya@northstar.studio",
      department: "Design",
      seatCount: 15,
      pricePerSeat: 18,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-figma-1",
          date: "2026-08-18",
          amount: 216,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "FIGMA.COM *PRO PLAN 15 SEATS"
        },
        {
          id: "chg-figma-2",
          date: "2026-09-18",
          amount: 216,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "FIGMA.COM *PRO PLAN 15 SEATS"
        },
        {
          id: "chg-figma-3",
          date: "2026-10-18",
          amount: 270,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "FIGMA.COM *PRO PLAN 15 SEATS (DEV MODE UPSELL)",
          note: "Stealth +25% seat rate bump without headcount increase"
        }
      ]
    },
    {
      id: "sub-slack",
      vendor: "Slack",
      normalizedMerchant: "slack",
      category: "Collaboration",
      billingCycle: "monthly",
      currency: "USD",
      amount: 280,
      previousAmount: 245,
      nextRenewalDate: "2026-11-15",
      lastChargedDate: "2026-10-15",
      paymentSource: "Amex Business \u2022\u20221004",
      discoverySource: "plaid",
      status: "active",
      ownerName: "Devon Brooks",
      ownerEmail: "devon@northstar.studio",
      department: "Operations",
      seatCount: 28,
      pricePerSeat: 10,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-slack-1",
          date: "2026-08-15",
          amount: 245,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "SLACK TECHNOLOGIES 800-884-8000"
        },
        {
          id: "chg-slack-2",
          date: "2026-09-15",
          amount: 245,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "SLACK TECHNOLOGIES 800-884-8000"
        },
        {
          id: "chg-slack-3",
          date: "2026-10-15",
          amount: 280,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "SLACK TECHNOLOGIES PRO TIER"
        }
      ]
    },
    {
      id: "sub-hubspot",
      vendor: "HubSpot",
      normalizedMerchant: "hubspot",
      category: "CRM & Sales",
      billingCycle: "monthly",
      currency: "USD",
      amount: 890,
      previousAmount: 650,
      nextRenewalDate: "2026-11-22",
      lastChargedDate: "2026-10-22",
      paymentSource: "Amex Business \u2022\u20221004",
      discoverySource: "gmail",
      status: "active",
      ownerName: "Hannah Park",
      ownerEmail: "hannah@northstar.studio",
      department: "Revenue",
      seatCount: 10,
      pricePerSeat: 89,
      autoRenewNoticeDays: 30,
      chargeHistory: [
        {
          id: "chg-hubspot-1",
          date: "2026-09-22",
          amount: 650,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "HUBSPOT INC *STARTER BUNDLE"
        },
        {
          id: "chg-hubspot-2",
          date: "2026-10-22",
          amount: 890,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "HUBSPOT INC *MARKETING PRO CONTACT TIER"
        }
      ]
    },
    {
      id: "sub-notion",
      vendor: "Notion",
      normalizedMerchant: "notion",
      category: "Collaboration",
      billingCycle: "monthly",
      currency: "USD",
      amount: 264,
      previousAmount: 264,
      nextRenewalDate: "2026-11-25",
      lastChargedDate: "2026-10-25",
      paymentSource: "Chase Ink \u2022\u20224821",
      discoverySource: "gmail",
      status: "active",
      ownerName: "Devon Brooks",
      ownerEmail: "devon@northstar.studio",
      department: "Operations",
      seatCount: 22,
      pricePerSeat: 12,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-notion-1",
          date: "2026-09-25",
          amount: 264,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "NOTION LABS INC SAN FRANCISCO"
        },
        {
          id: "chg-notion-2",
          date: "2026-10-25",
          amount: 264,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "NOTION LABS INC SAN FRANCISCO"
        }
      ]
    },
    {
      id: "sub-openai",
      vendor: "OpenAI",
      normalizedMerchant: "openai",
      category: "AI & Dev",
      billingCycle: "monthly",
      currency: "USD",
      amount: 450,
      previousAmount: 360,
      nextRenewalDate: "2026-11-19",
      lastChargedDate: "2026-10-19",
      paymentSource: "Mercury Checking \u2022\u20228812",
      discoverySource: "plaid",
      status: "active",
      ownerName: "Arjun Patel",
      ownerEmail: "arjun@northstar.studio",
      department: "Engineering",
      seatCount: 18,
      pricePerSeat: 25,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-openai-1",
          date: "2026-09-19",
          amount: 360,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "OPENAI *CHATGPT TEAM"
        },
        {
          id: "chg-openai-2",
          date: "2026-10-19",
          amount: 450,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "OPENAI *CHATGPT TEAM + API OVERAGE"
        }
      ]
    },
    {
      id: "sub-github",
      vendor: "GitHub",
      normalizedMerchant: "github",
      category: "AI & Dev",
      billingCycle: "monthly",
      currency: "USD",
      amount: 228,
      previousAmount: 228,
      nextRenewalDate: "2026-12-03",
      lastChargedDate: "2026-11-03",
      paymentSource: "Chase Ink \u2022\u20224821",
      discoverySource: "gmail",
      status: "active",
      ownerName: "Arjun Patel",
      ownerEmail: "arjun@northstar.studio",
      department: "Engineering",
      seatCount: 12,
      pricePerSeat: 19,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-github-1",
          date: "2026-10-03",
          amount: 228,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "GITHUB.COM *TEAM + COPILOT"
        },
        {
          id: "chg-github-2",
          date: "2026-11-03",
          amount: 228,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "GITHUB.COM *TEAM + COPILOT"
        }
      ]
    },
    {
      id: "sub-linear",
      vendor: "Linear",
      normalizedMerchant: "linear",
      category: "AI & Dev",
      billingCycle: "monthly",
      currency: "USD",
      amount: 160,
      previousAmount: 160,
      nextRenewalDate: "2026-12-01",
      lastChargedDate: "2026-11-01",
      paymentSource: "Chase Ink \u2022\u20224821",
      discoverySource: "outlook",
      status: "active",
      ownerName: "Arjun Patel",
      ownerEmail: "arjun@northstar.studio",
      department: "Engineering",
      seatCount: 16,
      pricePerSeat: 10,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-linear-1",
          date: "2026-10-01",
          amount: 160,
          currency: "USD",
          source: "outlook",
          rawDescriptor: "LINEAR.APP PLUS PLAN"
        },
        {
          id: "chg-linear-2",
          date: "2026-11-01",
          amount: 160,
          currency: "USD",
          source: "outlook",
          rawDescriptor: "LINEAR.APP PLUS PLAN"
        }
      ]
    },
    {
      id: "sub-loom",
      vendor: "Loom",
      normalizedMerchant: "loom",
      category: "Collaboration",
      billingCycle: "monthly",
      currency: "USD",
      amount: 180,
      previousAmount: 150,
      nextRenewalDate: "2026-11-16",
      lastChargedDate: "2026-10-16",
      paymentSource: "Amex Business \u2022\u20221004",
      discoverySource: "plaid",
      status: "active",
      ownerName: "Maya Lin",
      ownerEmail: "maya@northstar.studio",
      department: "Design",
      seatCount: 12,
      pricePerSeat: 15,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-loom-1",
          date: "2026-09-16",
          amount: 150,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "LOOM.COM *BUSINESS"
        },
        {
          id: "chg-loom-2",
          date: "2026-10-16",
          amount: 180,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "LOOM.COM *BUSINESS AI ADDON"
        }
      ]
    },
    {
      id: "sub-adobe",
      vendor: "Adobe Creative Cloud",
      normalizedMerchant: "adobe",
      category: "Design",
      billingCycle: "annual",
      currency: "USD",
      amount: 3599.88,
      previousAmount: 2999.88,
      nextRenewalDate: "2026-11-24",
      lastChargedDate: "2025-11-24",
      paymentSource: "Amex Business \u2022\u20221004",
      discoverySource: "gmail",
      status: "active",
      ownerName: "Maya Lin",
      ownerEmail: "maya@northstar.studio",
      department: "Design",
      seatCount: 5,
      pricePerSeat: 59.99,
      autoRenewNoticeDays: 30,
      chargeHistory: [
        {
          id: "chg-adobe-1",
          date: "2024-11-24",
          amount: 2999.88,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "ADOBE SYSTEMS INC ANNUAL"
        },
        {
          id: "chg-adobe-2",
          date: "2025-11-24",
          amount: 3599.88,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "ADOBE SYSTEMS INC ANNUAL RENEWAL"
        }
      ]
    },
    {
      id: "sub-aws",
      vendor: "AWS",
      normalizedMerchant: "aws",
      category: "Infrastructure",
      billingCycle: "monthly",
      currency: "USD",
      amount: 640,
      previousAmount: 615,
      nextRenewalDate: "2026-12-02",
      lastChargedDate: "2026-11-02",
      paymentSource: "Mercury Checking \u2022\u20228812",
      discoverySource: "plaid",
      status: "active",
      ownerName: "Arjun Patel",
      ownerEmail: "arjun@northstar.studio",
      department: "Engineering",
      seatCount: null,
      pricePerSeat: null,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-aws-1",
          date: "2026-10-02",
          amount: 615,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "AMAZON WEB SERVICES"
        },
        {
          id: "chg-aws-2",
          date: "2026-11-02",
          amount: 640,
          currency: "USD",
          source: "plaid",
          rawDescriptor: "AMAZON WEB SERVICES"
        }
      ]
    },
    {
      id: "sub-1password",
      vendor: "1Password",
      normalizedMerchant: "1password",
      category: "Security",
      billingCycle: "monthly",
      currency: "USD",
      amount: 224,
      previousAmount: 224,
      nextRenewalDate: "2026-11-28",
      lastChargedDate: "2026-10-28",
      paymentSource: "Chase Ink \u2022\u20224821",
      discoverySource: "gmail",
      status: "active",
      ownerName: "Devon Brooks",
      ownerEmail: "devon@northstar.studio",
      department: "Security",
      seatCount: 28,
      pricePerSeat: 8,
      autoRenewNoticeDays: 7,
      chargeHistory: [
        {
          id: "chg-1p-1",
          date: "2026-10-28",
          amount: 224,
          currency: "USD",
          source: "gmail",
          rawDescriptor: "1PASSWORD.COM BUSINESS"
        }
      ]
    },
    {
      id: "sub-datadog",
      vendor: "Datadog",
      normalizedMerchant: "datadog",
      category: "Infrastructure",
      billingCycle: "monthly",
      currency: "EUR",
      amount: 195,
      previousAmount: 195,
      nextRenewalDate: "2026-11-21",
      lastChargedDate: "2026-10-21",
      paymentSource: "Mercury Checking \u2022\u20228812",
      discoverySource: "outlook",
      status: "active",
      ownerName: "Arjun Patel",
      ownerEmail: "arjun@northstar.studio",
      department: "Engineering",
      seatCount: null,
      pricePerSeat: null,
      autoRenewNoticeDays: 14,
      chargeHistory: [
        {
          id: "chg-dd-1",
          date: "2026-10-21",
          amount: 195,
          currency: "EUR",
          source: "outlook",
          rawDescriptor: "DATADOG EU CLOUD PRO"
        }
      ]
    }
  ];
  const priceHikes = [];
  for (const sub of subscriptions) {
    if (sub.chargeHistory.length >= 2) {
      const len = sub.chargeHistory.length;
      const alert = detectHikeFromChargePair({
        subscription: sub,
        previousCharge: sub.chargeHistory[len - 2],
        latestCharge: sub.chargeHistory[len - 1],
        thresholdPct: 3,
        source: sub.discoverySource
      });
      if (alert) priceHikes.push(alert);
    }
  }
  const rawSeats = [
    {
      id: "seat-figma-chris",
      subscriptionId: "sub-figma",
      vendor: "Figma",
      employeeName: "Chris Morales",
      employeeEmail: "chris.m@northstar.studio",
      department: "Marketing",
      employmentStatus: "offboarded",
      seatCostMonthlyUsd: 18,
      lastSsoLoginAt: "2026-08-29",
      lastSlackActiveAt: "2026-08-30",
      activitySource: "both",
      status: "flagged"
    },
    {
      id: "seat-hubspot-elena",
      subscriptionId: "sub-hubspot",
      vendor: "HubSpot",
      employeeName: "Elena Vance",
      employeeEmail: "elena.v@northstar.studio",
      department: "Sales",
      employmentStatus: "offboarded",
      seatCostMonthlyUsd: 89,
      lastSsoLoginAt: "2026-09-12",
      lastSlackActiveAt: "2026-09-14",
      activitySource: "both",
      status: "flagged"
    },
    {
      id: "seat-adobe-troy",
      subscriptionId: "sub-adobe",
      vendor: "Adobe Creative Cloud",
      employeeName: "Troy Bennett",
      employeeEmail: "troy.b@northstar.studio",
      department: "Brand",
      employmentStatus: "active",
      seatCostMonthlyUsd: 59.99,
      lastSsoLoginAt: "2026-09-18",
      lastSlackActiveAt: "2026-09-21",
      activitySource: "google_workspace_sso",
      status: "flagged"
    },
    {
      id: "seat-openai-nina",
      subscriptionId: "sub-openai",
      vendor: "OpenAI",
      employeeName: "Nina Kowalski",
      employeeEmail: "nina.k@northstar.studio",
      department: "Customer Success",
      employmentStatus: "active",
      seatCostMonthlyUsd: 25,
      lastSsoLoginAt: "2026-09-24",
      lastSlackActiveAt: "2026-09-27",
      activitySource: "both",
      status: "flagged"
    },
    {
      id: "seat-loom-sam",
      subscriptionId: "sub-loom",
      vendor: "Loom",
      employeeName: "Samir Rao",
      employeeEmail: "samir.r@northstar.studio",
      department: "Operations",
      employmentStatus: "active",
      seatCostMonthlyUsd: 15,
      lastSsoLoginAt: "2026-09-30",
      lastSlackActiveAt: "2026-10-02",
      activitySource: "slack",
      status: "flagged"
    },
    {
      id: "seat-notion-rachel",
      subscriptionId: "sub-notion",
      vendor: "Notion",
      employeeName: "Rachel Kim",
      employeeEmail: "rachel.k@northstar.studio",
      department: "Finance",
      employmentStatus: "active",
      seatCostMonthlyUsd: 12,
      lastSsoLoginAt: "2026-10-03",
      lastSlackActiveAt: "2026-10-05",
      activitySource: "google_workspace_sso",
      status: "flagged"
    },
    {
      id: "seat-github-leo",
      subscriptionId: "sub-github",
      vendor: "GitHub",
      employeeName: "Leo Vance",
      employeeEmail: "leo.v@northstar.studio",
      department: "Engineering",
      employmentStatus: "active",
      seatCostMonthlyUsd: 19,
      lastSsoLoginAt: "2026-09-19",
      lastSlackActiveAt: "2026-09-20",
      activitySource: "both",
      status: "nudge_sent"
    },
    {
      id: "seat-slack-olivia",
      subscriptionId: "sub-slack",
      vendor: "Slack",
      employeeName: "Olivia Grant",
      employeeEmail: "olivia.g@northstar.studio",
      department: "Contractors",
      employmentStatus: "offboarded",
      seatCostMonthlyUsd: 10,
      lastSsoLoginAt: "2026-08-14",
      lastSlackActiveAt: "2026-08-14",
      activitySource: "slack",
      status: "reclaimed",
      reclaimedAt: "2026-11-04"
    },
    {
      id: "seat-figma-maya",
      subscriptionId: "sub-figma",
      vendor: "Figma",
      employeeName: "Maya Lin",
      employeeEmail: "maya@northstar.studio",
      department: "Design",
      employmentStatus: "active",
      seatCostMonthlyUsd: 18,
      lastSsoLoginAt: "2026-11-10",
      lastSlackActiveAt: "2026-11-11",
      activitySource: "both",
      status: "exempt"
    }
  ];
  const zombieSeats = rawSeats.map(
    (s) => evaluateZombieSeat(s, 30, REFERENCE_TODAY)
  );
  return {
    settings: {
      companyName: "Northstar Studio (28 employees)",
      planTier: "free",
      zombieThresholdDays: 30,
      priceHikeThresholdPct: 3,
      renewalNoticeWindowDays: 14,
      referenceDate: REFERENCE_TODAY
    },
    connectors: [
      {
        id: "gmail",
        name: "Gmail (Read-Only)",
        category: "inbox",
        mode: "read_only",
        connected: true,
        accountLabel: "finance@northstar.studio",
        lastSyncedAt: `${REFERENCE_TODAY}T09:15:00Z`,
        itemsScanned: 1842,
        findingsCount: 6,
        description: "Reads billing receipts & renewal notices via gmail.readonly scope."
      },
      {
        id: "outlook",
        name: "Microsoft Outlook (Read-Only)",
        category: "inbox",
        mode: "read_only",
        connected: true,
        accountLabel: "ops-billing@northstar.studio",
        lastSyncedAt: `${REFERENCE_TODAY}T09:15:00Z`,
        itemsScanned: 412,
        findingsCount: 2,
        description: "Parses Microsoft 365 vendor invoices & annual renewal warnings."
      },
      {
        id: "plaid",
        name: "Plaid Bank & Card Feed",
        category: "banking",
        mode: "read_only",
        connected: true,
        accountLabel: "Chase Ink \u2022\u20224821, Amex \u2022\u20221004, Mercury \u2022\u20228812",
        lastSyncedAt: `${REFERENCE_TODAY}T09:12:00Z`,
        itemsScanned: 329,
        findingsCount: 4,
        description: "Monitors your existing cards & checking accounts with zero virtual-card switch."
      },
      {
        id: "google_workspace",
        name: "Google Workspace SSO",
        category: "identity",
        mode: "read_only",
        connected: true,
        accountLabel: "northstar.studio (28 active, 3 offboarded)",
        lastSyncedAt: `${REFERENCE_TODAY}T08:50:00Z`,
        itemsScanned: 214,
        findingsCount: 5,
        description: "Checks last SSO app login timestamps to flag 30+ day zombie seats."
      },
      {
        id: "slack",
        name: "Slack Workspace Activity",
        category: "identity",
        mode: "read_only",
        connected: true,
        accountLabel: "northstar-hq.slack.com",
        lastSyncedAt: `${REFERENCE_TODAY}T08:52:00Z`,
        itemsScanned: 168,
        findingsCount: 2,
        description: "Detects inactive channels/users and sends 1-click check-in nudges."
      }
    ],
    subscriptions,
    priceHikes,
    zombieSeats,
    logs: [
      {
        id: "log-1",
        timestamp: `${REFERENCE_TODAY}T09:15:00Z`,
        kind: "connector_sync",
        summary: `Synced Gmail, Outlook & bank feeds across 3 cards \u2014 found ${subscriptions.length} subscriptions and ${priceHikes.length} price increases.`,
        subscriptionsTouched: 12,
        hikesDetected: priceHikes.length,
        zombiesFlagged: 0
      },
      {
        id: "log-2",
        timestamp: `${REFERENCE_TODAY}T08:52:00Z`,
        kind: "connector_sync",
        summary: "Checked Google Workspace & Slack sign-ins \u2014 found 7 seats unused for 30+ days (2 former team members).",
        subscriptionsTouched: 0,
        hikesDetected: 0,
        zombiesFlagged: 7
      }
    ],
    updatedAt: `${REFERENCE_TODAY}T09:15:00Z`
  };
}
var SAMPLE_INBOX_EMAILS = [
  {
    label: "Vercel Pro Price Hike Receipt",
    rawText: `From: billing@vercel.com
Subject: Your Vercel invoice for November 2026
Date: 2026-11-10
Billed to: Northstar Studio (Visa ending in 4821)
Plan: Vercel Pro \u2014 6 team seats ($24.00/seat/mo, new rate)
Invoice Total: $144.00 USD
Billing cycle: Monthly
Next billing date: 2026-12-10`
  },
  {
    label: "Sentry Team Annual Renewal Notice",
    rawText: `From: billing@sentry.io
Subject: Sentry Invoice #INV-94821 \u2014 Annual Plan
Date: 2026-11-09
Total Paid: $960.00 USD (annual)
Payment method: Amex Business ending in 1004
Seats: 12 users
Next renewal date: 2027-11-09`
  },
  {
    label: "Intercom Stealth Seat Increase",
    rawText: `From: invoicing@intercom.io
Subject: Intercom Receipt \u2014 Updated Pricing
Date: 2026-11-08
Amount Paid: $395.00 USD (monthly)
Seats: 5 seats
Note: Price update effective this cycle \u2014 previously $299.00/mo
Card: Chase Ink ending in 4821`
  }
];
var CONNECTOR_SYNC_BATCHES = {
  gmail: {
    rawEmail: SAMPLE_INBOX_EMAILS[0].rawText,
    summary: "Gmail read-only sync parsed a new Vercel Pro invoice ($144.00/mo, $24/seat)."
  },
  outlook: {
    rawEmail: SAMPLE_INBOX_EMAILS[2].rawText,
    summary: "Outlook read-only sync caught an Intercom pricing update email ($395.00/mo)."
  },
  plaid: {
    csvTransactions: `Date,Description,Amount,Currency,Card
2026-10-05,CLOUDFLARE* PRO PLAN,20.00,USD,Chase Ink \u2022\u20224821
2026-11-05,CLOUDFLARE* PRO PLAN,25.00,USD,Chase Ink \u2022\u20224821
2026-10-12,CANVA* TEAMS 6 SEATS,72.00,USD,Amex Business \u2022\u20221004
2026-11-10,CANVA* TEAMS 6 SEATS,90.00,USD,Amex Business \u2022\u20221004`,
    summary: "Plaid card sync pulled new Cloudflare (+25% hike) & Canva Teams (+25% hike) charges."
  },
  google_workspace: {
    seatCsv: `vendor,employeeName,employeeEmail,department,seatCostMonthlyUsd,lastSsoLoginAt,lastSlackActiveAt,employmentStatus
Vercel,Kevin Cho,kevin.c@northstar.studio,Engineering,24,2026-08-22,,offboarded
Canva Teams,Jordan Ellis,jordan.e@northstar.studio,Marketing,15,2026-09-10,,active`,
    summary: "Google Workspace SSO flagged Kevin Cho (offboarded, Vercel $24/mo) & Jordan Ellis (62d inactive, Canva $15/mo)."
  },
  slack: {
    seatCsv: `vendor,employeeName,employeeEmail,department,seatCostMonthlyUsd,lastSsoLoginAt,lastSlackActiveAt,employmentStatus
Linear,Priya Nair,priya.n@northstar.studio,Product,10,,2026-10-03,active`,
    summary: "Slack activity sync flagged Priya Nair (39d inactive on Linear, $10/mo)."
  }
};

// src/server/app.ts
function withLog(state, entry) {
  const log = {
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...entry
  };
  return {
    ...state,
    logs: [log, ...state.logs].slice(0, 40),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function respondWorkspace(state) {
  const normalizedState = state.settings.planTier === "free" ? state : {
    ...state,
    settings: {
      ...state.settings,
      planTier: "free"
    }
  };
  return {
    state: normalizedState,
    metrics: computeWorkspaceMetrics(normalizedState)
  };
}
function createApp({ store, getClientHtml: getClientHtml2 }) {
  const app2 = new Hono();
  app2.use("*", async (c, next) => {
    await next();
    if (!c.res.headers.has("Content-Security-Policy")) {
      c.res.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      );
    }
    c.res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    c.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });
  app2.use(
    "/api/*",
    cors({
      origin: (origin) => {
        if (!origin) return origin;
        if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:") || origin.endsWith(".vercel.app") || origin.endsWith(".netlify.app")) {
          return origin;
        }
        return void 0;
      },
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"]
    })
  );
  app2.get("/api/health", async (c) => {
    const state = await store.getState();
    return c.json({
      ok: true,
      service: "subledger",
      subscriptions: state.subscriptions.length,
      storage: store.getStorageInfo(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/workspace", async (c) => {
    const state = await store.getState();
    return c.json(respondWorkspace(state));
  });
  app2.post("/api/workspace/reset", async (c) => {
    const demo = createDemoWorkspaceState();
    const saved = await store.saveState(demo);
    return c.json(respondWorkspace(saved));
  });
  app2.post("/api/workspace/empty", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const companyName = typeof body?.companyName === "string" && body.companyName.trim() ? body.companyName.trim() : "My Company";
    const empty = createEmptyWorkspaceState(companyName);
    const saved = await store.saveState(empty);
    return c.json(respondWorkspace(saved));
  });
  app2.patch("/api/settings", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid settings payload" }, 400);
    }
    const current = await store.getState();
    const nextSettings = {
      ...current.settings,
      companyName: typeof body.companyName === "string" && body.companyName.trim() ? body.companyName.trim() : current.settings.companyName,
      planTier: "free",
      zombieThresholdDays: typeof body.zombieThresholdDays === "number" && body.zombieThresholdDays >= 7 && body.zombieThresholdDays <= 180 ? Math.round(body.zombieThresholdDays) : current.settings.zombieThresholdDays,
      priceHikeThresholdPct: typeof body.priceHikeThresholdPct === "number" && body.priceHikeThresholdPct >= 1 && body.priceHikeThresholdPct <= 50 ? body.priceHikeThresholdPct : current.settings.priceHikeThresholdPct,
      renewalNoticeWindowDays: typeof body.renewalNoticeWindowDays === "number" && body.renewalNoticeWindowDays >= 3 && body.renewalNoticeWindowDays <= 90 ? Math.round(body.renewalNoticeWindowDays) : current.settings.renewalNoticeWindowDays
    };
    const reevaluated = reevaluateWorkspaceZombies(
      { ...current, settings: nextSettings },
      nextSettings.zombieThresholdDays
    );
    const saved = await store.saveState(reevaluated);
    return c.json(respondWorkspace(saved));
  });
  app2.post("/api/subscriptions", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.vendor !== "string" || !body.vendor.trim()) {
      return c.json({ error: "Vendor name is required" }, 400);
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ error: "Amount must be greater than zero" }, 400);
    }
    const state = await store.getState();
    const matched = matchVendorDescriptor(body.vendor.trim());
    const cycle = body.billingCycle === "annual" || body.billingCycle === "quarterly" ? body.billingCycle : "monthly";
    const currency = body.currency === "EUR" || body.currency === "GBP" || body.currency === "CAD" || body.currency === "AUD" ? body.currency : "USD";
    const lastChargedDate = typeof body.lastChargedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.lastChargedDate) ? body.lastChargedDate : state.settings.referenceDate;
    const nextRenewalDate = typeof body.nextRenewalDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.nextRenewalDate) ? body.nextRenewalDate : computeNextRenewalDate(lastChargedDate, cycle, state.settings.referenceDate);
    const seatCount = typeof body.seatCount === "number" && body.seatCount > 0 ? Math.round(body.seatCount) : null;
    const newSub = {
      id: `sub-${matched.normalizedMerchant}-${Date.now().toString(36)}`,
      vendor: body.vendor.trim(),
      normalizedMerchant: matched.normalizedMerchant,
      category: body.category || matched.category || "Other",
      billingCycle: cycle,
      currency,
      amount,
      previousAmount: typeof body.previousAmount === "number" && body.previousAmount > 0 ? body.previousAmount : null,
      nextRenewalDate,
      lastChargedDate,
      paymentSource: typeof body.paymentSource === "string" && body.paymentSource.trim() ? body.paymentSource.trim() : "Chase Ink \u2022\u20224821",
      discoverySource: "manual",
      status: "active",
      ownerName: typeof body.ownerName === "string" && body.ownerName.trim() ? body.ownerName.trim() : "Finance Owner",
      ownerEmail: typeof body.ownerEmail === "string" && body.ownerEmail.trim() ? body.ownerEmail.trim() : "finance@company.io",
      department: typeof body.department === "string" && body.department.trim() ? body.department.trim() : "Operations",
      seatCount,
      pricePerSeat: seatCount ? Math.round(amount / seatCount * 100) / 100 : null,
      autoRenewNoticeDays: cycle === "annual" ? 30 : 7,
      chargeHistory: [
        {
          id: `chg-${Date.now().toString(36)}`,
          date: lastChargedDate,
          amount,
          currency,
          source: "manual",
          rawDescriptor: body.vendor.trim().toUpperCase()
        }
      ]
    };
    let nextHikes = [...state.priceHikes];
    if (newSub.previousAmount && newSub.amount > newSub.previousAmount) {
      const alert = detectHikeFromChargePair({
        subscription: newSub,
        previousCharge: {
          id: "prev",
          date: lastChargedDate,
          amount: newSub.previousAmount,
          currency,
          source: "manual",
          rawDescriptor: newSub.vendor
        },
        latestCharge: newSub.chargeHistory[0],
        thresholdPct: state.settings.priceHikeThresholdPct,
        source: "manual"
      });
      if (alert) nextHikes = [alert, ...nextHikes];
    }
    const nextState = withLog(
      {
        ...state,
        subscriptions: [newSub, ...state.subscriptions],
        priceHikes: nextHikes
      },
      {
        kind: "manual_add",
        summary: `Added ${newSub.vendor} (${newSub.currency} ${newSub.amount}/${newSub.billingCycle}).`,
        subscriptionsTouched: 1,
        hikesDetected: nextHikes.length - state.priceHikes.length,
        zombiesFlagged: 0
      }
    );
    const saved = await store.saveState(nextState);
    return c.json(respondWorkspace(saved), 201);
  });
  app2.patch("/api/subscriptions/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid update payload" }, 400);
    }
    const state = await store.getState();
    const idx = state.subscriptions.findIndex((s) => s.id === id);
    if (idx === -1) {
      return c.json({ error: "Subscription not found" }, 404);
    }
    const existing = state.subscriptions[idx];
    const nextAmount = typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0 ? body.amount : existing.amount;
    const nextSeatCount = body.seatCount === null ? null : typeof body.seatCount === "number" && Number.isFinite(body.seatCount) && body.seatCount >= 0 ? Math.round(body.seatCount) : existing.seatCount;
    const updated = {
      ...existing,
      status: body.status === "active" || body.status === "trial" || body.status === "canceling" || body.status === "canceled" ? body.status : existing.status,
      amount: nextAmount,
      billingCycle: body.billingCycle === "monthly" || body.billingCycle === "annual" || body.billingCycle === "quarterly" ? body.billingCycle : existing.billingCycle,
      ownerName: typeof body.ownerName === "string" && body.ownerName.trim() ? body.ownerName.trim() : existing.ownerName,
      department: typeof body.department === "string" && body.department.trim() ? body.department.trim() : existing.department,
      seatCount: nextSeatCount,
      pricePerSeat: nextSeatCount && nextSeatCount > 0 ? Math.round(nextAmount / nextSeatCount * 100) / 100 : null
    };
    const nextSubs = [...state.subscriptions];
    nextSubs[idx] = updated;
    const saved = await store.saveState({
      ...state,
      subscriptions: nextSubs,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return c.json(respondWorkspace(saved));
  });
  app2.delete("/api/subscriptions/:id", async (c) => {
    const id = c.req.param("id");
    const state = await store.getState();
    if (!state.subscriptions.some((s) => s.id === id)) {
      return c.json({ error: "Subscription not found" }, 404);
    }
    const saved = await store.saveState({
      ...state,
      subscriptions: state.subscriptions.filter((s) => s.id !== id),
      priceHikes: state.priceHikes.filter((h) => h.subscriptionId !== id),
      zombieSeats: state.zombieSeats.filter((z) => z.subscriptionId !== id),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return c.json(respondWorkspace(saved));
  });
  app2.post("/api/discover/inbox", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.rawText !== "string" || !body.rawText.trim()) {
      return c.json({ error: "Email or invoice text is required" }, 400);
    }
    const source = body.source === "outlook" ? "outlook" : "gmail";
    const state = await store.getState();
    const parsed = parseInvoiceEmail(body.rawText, state.settings.referenceDate);
    const { nextState, subscription, hikeDetected, created } = ingestParsedInvoiceIntoWorkspace(state, parsed, source);
    const logged = withLog(nextState, {
      kind: "inbox_paste",
      summary: `${source === "outlook" ? "Outlook" : "Gmail"} parser ${created ? "discovered" : "updated"} ${subscription.vendor} (${subscription.currency} ${subscription.amount}/${subscription.billingCycle})${hikeDetected ? ` and flagged a +${hikeDetected.percentIncrease}% price hike` : ""}.`,
      subscriptionsTouched: 1,
      hikesDetected: hikeDetected ? 1 : 0,
      zombiesFlagged: 0
    });
    const saved = await store.saveState(logged);
    return c.json({
      parsed,
      created,
      hikeDetected,
      ...respondWorkspace(saved)
    });
  });
  app2.post("/api/discover/transactions", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.csvText !== "string" || !body.csvText.trim()) {
      return c.json({ error: "CSV transaction content is required" }, 400);
    }
    const source = body.source === "plaid" ? "plaid" : "csv_import";
    const state = await store.getState();
    const parsedTxs = parseBankCsv(body.csvText, source === "plaid" ? "Plaid Card Feed" : "Bank CSV");
    if (parsedTxs.length === 0) {
      return c.json(
        {
          error: "Could not find valid Date, Description/Vendor, and Amount columns in CSV."
        },
        400
      );
    }
    const { nextState, subscriptionsAdded, subscriptionsUpdated, hikesDetected } = ingestTransactionsIntoWorkspace(state, parsedTxs, source);
    const logged = withLog(nextState, {
      kind: "csv_import",
      summary: `Scanned ${parsedTxs.length} card/bank rows: ${subscriptionsAdded} new, ${subscriptionsUpdated} updated, ${hikesDetected.length} stealth price hike(s) caught.`,
      subscriptionsTouched: subscriptionsAdded + subscriptionsUpdated,
      hikesDetected: hikesDetected.length,
      zombiesFlagged: 0
    });
    const saved = await store.saveState(logged);
    return c.json({
      parsedCount: parsedTxs.length,
      subscriptionsAdded,
      subscriptionsUpdated,
      hikesDetected,
      ...respondWorkspace(saved)
    });
  });
  app2.post("/api/discover/seats", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.csvText !== "string" || !body.csvText.trim()) {
      return c.json({ error: "Seat activity CSV content is required" }, 400);
    }
    const state = await store.getState();
    const imported = parseSeatActivityCsv(body.csvText, state);
    if (imported.length === 0) {
      return c.json(
        { error: "CSV must include vendor/app and email columns." },
        400
      );
    }
    const nextSeats = [...state.zombieSeats];
    for (const seat of imported) {
      const idx = nextSeats.findIndex(
        (existing) => existing.vendor.toLowerCase() === seat.vendor.toLowerCase() && existing.employeeEmail.toLowerCase() === seat.employeeEmail.toLowerCase()
      );
      if (idx >= 0) {
        nextSeats[idx] = { ...seat, status: nextSeats[idx].status };
      } else {
        nextSeats.unshift(seat);
      }
    }
    const logged = withLog(
      { ...state, zombieSeats: nextSeats },
      {
        kind: "seat_csv_import",
        summary: `Imported ${imported.length} identity seat record(s) from CSV.`,
        subscriptionsTouched: 0,
        hikesDetected: 0,
        zombiesFlagged: imported.filter((s) => s.daysInactive >= state.settings.zombieThresholdDays).length
      }
    );
    const saved = await store.saveState(logged);
    return c.json({
      importedCount: imported.length,
      ...respondWorkspace(saved)
    });
  });
  app2.post("/api/connectors/:id/toggle", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const state = await store.getState();
    const idx = state.connectors.findIndex((conn) => conn.id === id);
    if (idx === -1) {
      return c.json({ error: "Connector not found" }, 404);
    }
    const existing = state.connectors[idx];
    const nextConnected = typeof body?.connected === "boolean" ? body.connected : !existing.connected;
    const defaultLabels = {
      gmail: "finance@company.io (read-only)",
      outlook: "billing@company.onmicrosoft.com",
      plaid: "Business Checking & Corporate Visa (Read-Only)",
      google_workspace: "company.io SSO Directory",
      slack: "company-hq.slack.com"
    };
    const nextConnectors = [...state.connectors];
    nextConnectors[idx] = {
      ...existing,
      connected: nextConnected,
      accountLabel: nextConnected ? typeof body?.accountLabel === "string" && body.accountLabel.trim() ? body.accountLabel.trim() : existing.accountLabel === "Not connected" ? defaultLabels[id] : existing.accountLabel : "Not connected",
      lastSyncedAt: nextConnected ? (/* @__PURE__ */ new Date()).toISOString() : null
    };
    const saved = await store.saveState({
      ...state,
      connectors: nextConnectors,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return c.json(respondWorkspace(saved));
  });
  app2.post("/api/connectors/:id/sync", async (c) => {
    const id = c.req.param("id");
    const state = await store.getState();
    const connIdx = state.connectors.findIndex((conn) => conn.id === id);
    if (connIdx === -1) {
      return c.json({ error: "Connector not found" }, 404);
    }
    const batch = CONNECTOR_SYNC_BATCHES[id];
    let workingState = {
      ...state,
      connectors: state.connectors.map(
        (conn, i) => i === connIdx ? {
          ...conn,
          connected: true,
          accountLabel: conn.accountLabel === "Not connected" ? `${id.replace("_", ".")}@company.io` : conn.accountLabel,
          lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
          itemsScanned: conn.itemsScanned + 48
        } : conn
      )
    };
    let subsTouched = 0;
    let hikesFound = 0;
    let zombiesFound = 0;
    if (batch.rawEmail) {
      const parsed = parseInvoiceEmail(batch.rawEmail, workingState.settings.referenceDate);
      const res = ingestParsedInvoiceIntoWorkspace(
        workingState,
        parsed,
        id === "outlook" ? "outlook" : "gmail"
      );
      workingState = res.nextState;
      subsTouched += 1;
      if (res.hikeDetected) hikesFound += 1;
    }
    if (batch.csvTransactions) {
      const txs = parseBankCsv(batch.csvTransactions, "Plaid Read-Only Feed");
      const res = ingestTransactionsIntoWorkspace(workingState, txs, "plaid");
      workingState = res.nextState;
      subsTouched += res.subscriptionsAdded + res.subscriptionsUpdated;
      hikesFound += res.hikesDetected.length;
    }
    if (batch.seatCsv) {
      const seats = parseSeatActivityCsv(batch.seatCsv, workingState);
      const nextSeats = [...workingState.zombieSeats];
      for (const seat of seats) {
        const existsIdx = nextSeats.findIndex(
          (s) => s.vendor.toLowerCase() === seat.vendor.toLowerCase() && s.employeeEmail.toLowerCase() === seat.employeeEmail.toLowerCase()
        );
        if (existsIdx === -1) {
          nextSeats.unshift(seat);
          zombiesFound += 1;
        }
      }
      workingState = { ...workingState, zombieSeats: nextSeats };
    }
    workingState.connectors = workingState.connectors.map(
      (conn, i) => i === connIdx ? {
        ...conn,
        findingsCount: conn.findingsCount + subsTouched + hikesFound + zombiesFound
      } : conn
    );
    const logged = withLog(workingState, {
      kind: "connector_sync",
      summary: batch.summary,
      subscriptionsTouched: subsTouched,
      hikesDetected: hikesFound,
      zombiesFlagged: zombiesFound
    });
    const saved = await store.saveState(logged);
    return c.json(respondWorkspace(saved));
  });
  app2.post("/api/hikes/:id/action", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const status = body?.status;
    if (status !== "open" && status !== "disputing" && status !== "downgraded" && status !== "accepted") {
      return c.json({ error: "Invalid hike status" }, 400);
    }
    const state = await store.getState();
    const idx = state.priceHikes.findIndex((h) => h.id === id);
    if (idx === -1) {
      return c.json({ error: "Price hike alert not found" }, 404);
    }
    const nextHikes = [...state.priceHikes];
    nextHikes[idx] = { ...nextHikes[idx], status };
    const saved = await store.saveState({
      ...state,
      priceHikes: nextHikes,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return c.json(respondWorkspace(saved));
  });
  app2.post("/api/seats/bulk-action", async (c) => {
    const body = await c.req.json().catch(() => null);
    const seatIds = Array.isArray(body?.seatIds) ? body.seatIds : [];
    const status = body?.status;
    if (seatIds.length === 0 || status !== "flagged" && status !== "nudge_sent" && status !== "reclaim_scheduled" && status !== "reclaimed" && status !== "exempt") {
      return c.json({ error: "seatIds and valid status are required" }, 400);
    }
    const state = await store.getState();
    const idSet = new Set(seatIds);
    let touchedCount = 0;
    let monthlyFreed = 0;
    const nextSeats = state.zombieSeats.map((seat) => {
      if (!idSet.has(seat.id)) return seat;
      touchedCount += 1;
      if (status === "reclaimed" && seat.status !== "reclaimed") {
        monthlyFreed += seat.seatCostMonthlyUsd;
      }
      return {
        ...seat,
        status,
        reclaimedAt: status === "reclaimed" ? state.settings.referenceDate : seat.reclaimedAt
      };
    });
    if (touchedCount === 0) {
      return c.json({ error: "No matching seats found" }, 404);
    }
    const nextState = status === "reclaimed" ? withLog(
      { ...state, zombieSeats: nextSeats },
      {
        kind: "seat_reclaim",
        summary: `Reclaimed ${touchedCount} zombie seat(s), saving $${monthlyFreed.toFixed(2)}/mo ($${(monthlyFreed * 12).toFixed(0)}/yr).`,
        subscriptionsTouched: 0,
        hikesDetected: 0,
        zombiesFlagged: 0
      }
    ) : {
      ...state,
      zombieSeats: nextSeats,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const saved = await store.saveState(nextState);
    return c.json(respondWorkspace(saved));
  });
  app2.get("/api/export/csv", async (c) => {
    const state = await store.getState();
    const headers = [
      "Vendor",
      "Category",
      "Status",
      "Billing Cycle",
      "Amount",
      "Currency",
      "Monthly USD",
      "Annual USD",
      "Next Renewal",
      "Payment Source",
      "Discovery Source",
      "Owner",
      "Department"
    ];
    const rows = state.subscriptions.map(
      (s) => [
        s.vendor,
        s.category,
        s.status,
        s.billingCycle,
        s.amount.toFixed(2),
        s.currency,
        toMonthlyUsd(s.amount, s.currency, s.billingCycle).toFixed(2),
        toAnnualUsd(s.amount, s.currency, s.billingCycle).toFixed(2),
        s.nextRenewalDate,
        s.paymentSource,
        s.discoverySource,
        s.ownerName,
        s.department
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="subledger-subscriptions.csv"'
      }
    });
  });
  if (getClientHtml2) {
    let cachedScriptHashes = null;
    app2.get("*", async (c) => {
      if (c.req.path.startsWith("/api/")) {
        return c.json({ error: "Not found" }, 404);
      }
      const rawHtml = getClientHtml2();
      if (!cachedScriptHashes) {
        const hashes = [];
        const encoder = new TextEncoder();
        const tagOpen = "<script";
        const tagClose = "</script>";
        let pos = 0;
        while (pos < rawHtml.length) {
          const start = rawHtml.indexOf(tagOpen, pos);
          if (start === -1) break;
          const gt = rawHtml.indexOf(">", start);
          const end = gt === -1 ? -1 : rawHtml.indexOf(tagClose, gt + 1);
          if (gt === -1 || end === -1) break;
          const body = rawHtml.slice(gt + 1, end);
          if (body.trim().length > 0) {
            const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(body));
            const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
            hashes.push(`'sha256-${b64}'`);
          }
          pos = end + tagClose.length;
        }
        cachedScriptHashes = hashes;
      }
      const scriptSrc = cachedScriptHashes.length > 0 ? `'self' ${cachedScriptHashes.join(" ")}` : "'self'";
      c.header(
        "Content-Security-Policy",
        `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
      );
      return c.html(rawHtml);
    });
  }
  return app2;
}

// src/server/store.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { get as blobGet, put as blobPut } from "@vercel/blob";
var JsonFileWorkspaceStore = class {
  filePath;
  cache = null;
  constructor(filePath = path.join(process.cwd(), ".data", "workspace.json")) {
    this.filePath = filePath;
  }
  async getState() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf8");
        this.cache = JSON.parse(raw);
        return structuredClone(this.cache);
      }
    } catch {
    }
    if (this.cache) return structuredClone(this.cache);
    const demo = createDemoWorkspaceState();
    await this.saveState(demo);
    return demo;
  }
  async saveState(state) {
    this.cache = structuredClone(state);
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), "utf8");
    } catch {
    }
    return structuredClone(this.cache);
  }
  getStorageInfo() {
    return {
      driver: "file",
      persistent: true,
      note: `Local JSON file (${this.filePath})`
    };
  }
};
var PostgresWorkspaceStore = class {
  sql;
  workspaceId;
  readyPromise = null;
  fallbackCache = createDemoWorkspaceState();
  healthy = true;
  constructor(databaseUrl, workspaceId = "default") {
    this.workspaceId = workspaceId;
    this.sql = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5,
      ssl: databaseUrl.includes("railway.internal") || databaseUrl.includes("localhost") ? false : "prefer"
    });
  }
  ensureReady() {
    if (!this.readyPromise) {
      this.readyPromise = (async () => {
        await this.sql`
          CREATE TABLE IF NOT EXISTS subledger_workspaces (
            id TEXT PRIMARY KEY,
            state JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
      })();
    }
    return this.readyPromise;
  }
  async getState() {
    try {
      await this.ensureReady();
      const rows = await this.sql`
        SELECT state FROM subledger_workspaces WHERE id = ${this.workspaceId} LIMIT 1
      `;
      this.healthy = true;
      if (rows.length > 0 && rows[0]?.state) {
        const parsed = typeof rows[0].state === "string" ? JSON.parse(rows[0].state) : rows[0].state;
        this.fallbackCache = parsed;
        return structuredClone(parsed);
      }
      const initial = createDemoWorkspaceState();
      await this.saveState(initial);
      return initial;
    } catch (err) {
      this.healthy = false;
      this.readyPromise = null;
      console.error("[SubLedger][PostgresStore] getState fallback:", err);
      return structuredClone(this.fallbackCache);
    }
  }
  async saveState(state) {
    this.fallbackCache = structuredClone(state);
    try {
      await this.ensureReady();
      const payload = JSON.stringify(state);
      await this.sql`
        INSERT INTO subledger_workspaces (id, state, updated_at)
        VALUES (${this.workspaceId}, ${payload}::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
      `;
      this.healthy = true;
    } catch (err) {
      this.healthy = false;
      this.readyPromise = null;
      console.error("[SubLedger][PostgresStore] saveState fallback:", err);
    }
    return structuredClone(this.fallbackCache);
  }
  getStorageInfo() {
    return {
      driver: this.healthy ? "postgres" : "memory",
      persistent: this.healthy,
      note: this.healthy ? "PostgreSQL durable workspace store" : "PostgreSQL temporarily unavailable \u2014 serving memory fallback"
    };
  }
};
var VercelBlobWorkspaceStore = class {
  blobPath;
  fallback;
  healthy = true;
  constructor(blobPath = "subledger/workspace.json") {
    this.blobPath = blobPath;
    this.fallback = new JsonFileWorkspaceStore(path.join(os.tmpdir(), "subledger-workspace.json"));
  }
  async getState() {
    try {
      const result = await blobGet(this.blobPath, { access: "private", useCache: false });
      if (result && result.statusCode === 200 && result.stream) {
        const text = await new Response(result.stream).text();
        const parsed = JSON.parse(text);
        await this.fallback.saveState(parsed);
        this.healthy = true;
        return parsed;
      }
      const demo = createDemoWorkspaceState();
      await this.saveState(demo);
      return demo;
    } catch (err) {
      this.healthy = false;
      console.error("[SubLedger][VercelBlobStore] getState fallback:", err);
      return this.fallback.getState();
    }
  }
  async saveState(state) {
    const saved = await this.fallback.saveState(state);
    try {
      await blobPut(this.blobPath, JSON.stringify(saved, null, 2), {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json"
      });
      this.healthy = true;
    } catch (err) {
      this.healthy = false;
      console.error("[SubLedger][VercelBlobStore] saveState fallback:", err);
    }
    return saved;
  }
  getStorageInfo() {
    return {
      driver: this.healthy ? "vercel_blob" : "file",
      persistent: this.healthy,
      note: this.healthy ? "Vercel Blob private durable store" : "Vercel Blob temporarily unavailable \u2014 serving tmp fallback"
    };
  }
};
function createServerlessStore() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.trim().length > 0) {
    return new PostgresWorkspaceStore(databaseUrl.trim());
  }
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_STORE_ID?.trim()) {
    return new VercelBlobWorkspaceStore();
  }
  return new JsonFileWorkspaceStore(path.join(os.tmpdir(), "subledger-workspace.json"));
}

// api/index.ts
var CLIENT_HTML_GZIP_BASE64 = "__SUBLEDGER_CLIENT_HTML_GZIP_BASE64__";
var cachedHtml = null;
function getClientHtml() {
  if (cachedHtml) return cachedHtml;
  if (!CLIENT_HTML_GZIP_BASE64.startsWith("__SUBLEDGER_")) {
    const buf = Buffer.from(CLIENT_HTML_GZIP_BASE64, "base64");
    cachedHtml = gunzipSync(buf).toString("utf8");
    return cachedHtml;
  }
  const distHtmlPath = path2.join(process.cwd(), "dist", "client", "index.html");
  if (fs2.existsSync(distHtmlPath)) {
    cachedHtml = fs2.readFileSync(distHtmlPath, "utf8");
    return cachedHtml;
  }
  return "<!doctype html><html><body>SubLedger</body></html>";
}
var app = createApp({
  store: createServerlessStore(),
  getClientHtml
});
function normalizeVercelRequest(req) {
  const url = new URL(req.url, "http://localhost");
  const rewrittenPath = url.searchParams.get("__path");
  if (rewrittenPath && (url.pathname === "/api" || url.pathname === "/api/index" || url.pathname === "/api/vercel" || url.pathname === "/")) {
    url.pathname = rewrittenPath.startsWith("/") ? rewrittenPath : `/${rewrittenPath}`;
    url.searchParams.delete("__path");
    const init = {
      method: req.method,
      headers: req.headers
    };
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      init.body = req.body;
      init.duplex = "half";
    }
    return new Request(url.toString(), init);
  }
  return req;
}
var handle = (req) => app.fetch(normalizeVercelRequest(req));
var GET = handle;
var POST = handle;
var PUT = handle;
var PATCH = handle;
var DELETE = handle;
var OPTIONS = handle;
export {
  DELETE,
  GET,
  OPTIONS,
  PATCH,
  POST,
  PUT
};
