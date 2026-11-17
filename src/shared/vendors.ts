import type { SubscriptionCategory } from './types';

export interface VendorPattern {
  normalizedMerchant: string;
  vendor: string;
  category: SubscriptionCategory;
  keywords: string[];
  domains: string[];
  perSeatLikely?: boolean;
}

export const VENDOR_CATALOG: VendorPattern[] = [
  {
    normalizedMerchant: 'figma',
    vendor: 'Figma',
    category: 'Design',
    keywords: ['figma'],
    domains: ['figma.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'slack',
    vendor: 'Slack',
    category: 'Collaboration',
    keywords: ['slack', 'slack technologies'],
    domains: ['slack.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'notion',
    vendor: 'Notion',
    category: 'Collaboration',
    keywords: ['notion', 'notion labs'],
    domains: ['notion.so', 'makenotion.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'linear',
    vendor: 'Linear',
    category: 'AI & Dev',
    keywords: ['linear.app', 'linear orbit', 'linear'],
    domains: ['linear.app'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'github',
    vendor: 'GitHub',
    category: 'AI & Dev',
    keywords: ['github', 'github copilot'],
    domains: ['github.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'openai',
    vendor: 'OpenAI',
    category: 'AI & Dev',
    keywords: ['openai', 'chatgpt'],
    domains: ['openai.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'anthropic',
    vendor: 'Anthropic',
    category: 'AI & Dev',
    keywords: ['anthropic', 'claude'],
    domains: ['anthropic.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'vercel',
    vendor: 'Vercel',
    category: 'Infrastructure',
    keywords: ['vercel'],
    domains: ['vercel.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'aws',
    vendor: 'AWS',
    category: 'Infrastructure',
    keywords: ['amazon web services', 'aws'],
    domains: ['amazonaws.com', 'aws.amazon.com'],
  },
  {
    normalizedMerchant: 'hubspot',
    vendor: 'HubSpot',
    category: 'CRM & Sales',
    keywords: ['hubspot'],
    domains: ['hubspot.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'loom',
    vendor: 'Loom',
    category: 'Collaboration',
    keywords: ['loom.com', 'loom inc', 'loom'],
    domains: ['loom.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'zoom',
    vendor: 'Zoom',
    category: 'Collaboration',
    keywords: ['zoom.us', 'zoom video', 'zoom'],
    domains: ['zoom.us', 'zoom.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: '1password',
    vendor: '1Password',
    category: 'Security',
    keywords: ['1password', 'agilebits'],
    domains: ['1password.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'adobe',
    vendor: 'Adobe Creative Cloud',
    category: 'Design',
    keywords: ['adobe'],
    domains: ['adobe.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'datadog',
    vendor: 'Datadog',
    category: 'Infrastructure',
    keywords: ['datadog'],
    domains: ['datadoghq.com'],
  },
  {
    normalizedMerchant: 'sentry',
    vendor: 'Sentry',
    category: 'AI & Dev',
    keywords: ['sentry', 'functional software'],
    domains: ['sentry.io'],
  },
  {
    normalizedMerchant: 'intercom',
    vendor: 'Intercom',
    category: 'CRM & Sales',
    keywords: ['intercom'],
    domains: ['intercom.com', 'intercom.io'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'asana',
    vendor: 'Asana',
    category: 'Collaboration',
    keywords: ['asana'],
    domains: ['asana.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'airtable',
    vendor: 'Airtable',
    category: 'Collaboration',
    keywords: ['airtable'],
    domains: ['airtable.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'webflow',
    vendor: 'Webflow',
    category: 'Design',
    keywords: ['webflow'],
    domains: ['webflow.com'],
  },
  {
    normalizedMerchant: 'canva',
    vendor: 'Canva Teams',
    category: 'Design',
    keywords: ['canva'],
    domains: ['canva.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'docusign',
    vendor: 'DocuSign',
    category: 'Finance & Ops',
    keywords: ['docusign'],
    domains: ['docusign.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'gusto',
    vendor: 'Gusto',
    category: 'Finance & Ops',
    keywords: ['gusto'],
    domains: ['gusto.com'],
  },
  {
    normalizedMerchant: 'cloudflare',
    vendor: 'Cloudflare',
    category: 'Infrastructure',
    keywords: ['cloudflare'],
    domains: ['cloudflare.com'],
  },
  {
    normalizedMerchant: 'supabase',
    vendor: 'Supabase',
    category: 'Infrastructure',
    keywords: ['supabase'],
    domains: ['supabase.com', 'supabase.io'],
  },
  {
    normalizedMerchant: 'posthog',
    vendor: 'PostHog',
    category: 'AI & Dev',
    keywords: ['posthog'],
    domains: ['posthog.com'],
  },
  {
    normalizedMerchant: 'miro',
    vendor: 'Miro',
    category: 'Collaboration',
    keywords: ['miro', 'realtimeboard'],
    domains: ['miro.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'atlassian',
    vendor: 'Jira / Atlassian',
    category: 'AI & Dev',
    keywords: ['atlassian', 'jira', 'confluence'],
    domains: ['atlassian.com'],
    perSeatLikely: true,
  },
  {
    normalizedMerchant: 'quickbooks',
    vendor: 'QuickBooks Online',
    category: 'Finance & Ops',
    keywords: ['quickbooks', 'intuit'],
    domains: ['intuit.com'],
  },
  {
    normalizedMerchant: 'calendly',
    vendor: 'Calendly',
    category: 'CRM & Sales',
    keywords: ['calendly'],
    domains: ['calendly.com'],
    perSeatLikely: true,
  },
];

export function matchVendorDescriptor(rawText: string): {
  normalizedMerchant: string;
  vendor: string;
  category: SubscriptionCategory;
} {
  const lower = rawText.toLowerCase();
  for (const entry of VENDOR_CATALOG) {
    if (entry.domains.some((d) => lower.includes(d))) {
      return {
        normalizedMerchant: entry.normalizedMerchant,
        vendor: entry.vendor,
        category: entry.category,
      };
    }
    if (entry.keywords.some((k) => lower.includes(k))) {
      return {
        normalizedMerchant: entry.normalizedMerchant,
        vendor: entry.vendor,
        category: entry.category,
      };
    }
  }

  // Fallback clean up card processor noise and build readable vendor name
  const cleaned = rawText
    .replace(/^(SQ \*|STRIPE \*|PAYPAL \*|TST\*|PP\*|SP )/i, '')
    .replace(/\b(INC|LLC|LTD|CORP|CO|SAN FRAN|SF|CA|US|USA|BILLING)\b/gi, '')
    .replace(/[#*0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const vendor = words.length > 0 ? words.join(' ') : 'Unknown SaaS';
  const normalizedMerchant = vendor
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    normalizedMerchant: normalizedMerchant || 'unknown-saas',
    vendor,
    category: 'Other',
  };
}
