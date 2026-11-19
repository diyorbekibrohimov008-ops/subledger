# SubLedger

> SaaS subscription tracking ledger, automated renewal price-hike detection, and zombie seat utilization auditing for lean teams.

> [!WARNING]
> **Project Status — Work in Progress (Not Fully Ready)**
> This project is currently under active development and is **not fully ready for production**. Some parts, features, or workflow steps will fail or behave unexpectedly. We are actively working on fixing all remaining issues.

## Overview

SubLedger gives finance leads and startup operators clear visibility into recurring SaaS spend without spreadsheet sprawl:

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
