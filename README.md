# SubLedger

> Track all your recurring software bills in one place, spot price hikes, and find unused seats. **100% Free Forever ($0/mo)** — all features unlocked, no paywalls, no credit card, and no subscription limits.

> [!WARNING]
> **Project Status — Work in Progress (Not Fully Ready)**
> This project is currently under active development and is **not fully ready for production**. Some parts, features, or workflow steps will fail or behave unexpectedly. We are actively working on fixing all remaining issues.

## Overview

SubLedger is a **100% free ($0/mo forever)** recurring software ledger that gives individuals and teams clear visibility into SaaS spend without spreadsheet sprawl or paid tiers:

- **Subscription & Renewal Ledger:** Tracks active, trial, and canceling vendor contracts across multi-currency billing cycles (`USD`, `EUR`, `GBP`, `CAD`, `AUD`).
- **Stealth Price-Hike Detection:** Detects unit price increases, tier creep, promo expirations, and FX drift across charge history and bank/CSV transaction imports.
- **Zombie Seat Auditing:** Cross-references seat counts against SSO and Slack activity logs (`google_workspace_sso`, `slack`) to flag offboarded or idle licenses for reclamation.
- **Inbox Invoice Parser & Connectors:** Parses vendor billing emails and ingests bank CSVs or connector batches.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite, Lucide Icons
- **Backend:** Hono API (`src/server/app.ts`) running via Node.js (`@hono/node-server`), Vercel Functions (`api/`), or Netlify Functions (`netlify/functions/`)
- **Storage:** PostgreSQL (`postgres`) / `@vercel/blob` with built-in demo/in-memory store fallback
- **Testing:** Vitest (`vitest run`)

## Local Development

```bash
npm install
npm run typecheck
npm test
npm run build
```
