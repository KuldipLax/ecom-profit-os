# ECOM PROFIT OS

**Real Profit. Real Costs. Real-Time E-commerce Intelligence.**

Production-oriented multi-tenant SaaS architecture for e-commerce profitability across Shopify, shipping, Meta Ads, checkout/payment data, manual entries and CSV imports.

## What is implemented

- Next.js 16.3.6 + React + TypeScript + Tailwind CSS + Recharts.
- Supabase PostgreSQL, Auth, RLS and private Storage.
- Multi-tenant `businesses` + `memberships` isolation.
- Email/password signup, verification, login, forgot/reset password and secure SSR sessions.
- Admin and client application areas.
- Centralized Decimal.js profit calculation engine version `1.0.0`.
- Effective-delivery rules, RTO handling, date-effective COGS, shipping MAX logic, checkout fees, prepaid PG fees and Meta GST.
- Shopify GraphQL Admin API OAuth, historical/incremental order sync (request `read_all_orders` approval for data older than 60 days) and signed webhook intake.
- Shiprocket adapter behind a generic shipping-provider interface.
- Meta Ads OAuth, ad-account discovery and idempotent daily ad-level spend sync.
- Checkout abstraction with durable manual transaction + CSV fallback; no fake API data.
- CSV preview/map/validate/import with durable Supabase Storage and import history.
- Product, marketing, shipping, RTO, cohort and forward-forecast views.
- Reconciliation and data-health views.
- Audit logs, sync jobs, sync logs, webhook event storage and calculation snapshots.
- Vercel Cron-compatible scheduled sync endpoint.
- CSV report exports.

## Architecture

```
/app                     Next.js route/page layer
  /(auth)                Auth UI
  /dashboard             Profit command center
  /profit                Profit intelligence
  /orders                Order profitability + manual entry/adjustments
  /products              Product profitability
  /marketing             Meta marketing economics
  /shipping              Shipping intelligence
  /rto                   RTO intelligence
  /cohorts               Pickup cohorts
  /forecast              Forward projection
  /reports               Exports + reconciliation + CSV import
  /settings              Business/integration settings
  /admin                 Platform/admin control plane
  /api                   Route handlers, OAuth callbacks, webhooks, cron

/lib
  /auth                  Session + tenant access
  /db                    Database typing placeholder
  /integrations          Shopify, Meta, shipping, checkout adapters
  /profit-engine         Single source of truth for economics
  /forecast-engine       Projection logic
  /reconciliation        Source matching logic
  /validation            Zod schemas
  /security              Encryption, HMAC, rate limiting
  /analytics             Server-side aggregation helpers

/components               Reusable UI/forms/charts
/supabase/migrations      PostgreSQL schema + RLS
/tests                    Unit + environment-gated live integration contracts
/scripts/seed.ts          Test-only Supabase seed
```

## Profit methodology

The canonical implementation is in `lib/profit-engine/calculation.ts`. Detailed formulas are in `CALCULATION_METHODS.md`.

Key invariants:

1. One order = one P&L row, keyed by the business-local order number and/or source order ID.
2. Line items never independently create revenue rows.
3. RTO does not count as delivered.
4. Prepaid can be configured as effective delivered by default.
5. COGS priority is Variant > Product > Category > Default and uses the order date.
6. Shipping defaults to `MAX(total_freight, unbilled_charges)`.
7. Meta spend is applied once at period level; there is no official order-level Meta allocation.
8. Meta GST is calculated once as `Meta Spend × 18%` by default.
9. Intermediate currency arithmetic uses Decimal.js; UI formatting rounds to two decimals only at display time.
10. Profit snapshots persist the calculation version and the rules used.

## Critical test fixture

Business defaults:

- COGS = ₹140/unit
- Checkout = 2%
- Prepaid PG = 2%
- Meta GST = 18%

For a ₹1,000 delivered prepaid order with ₹100 shipping:

`₹1,000 - ₹140 - ₹20 - ₹20 - ₹100 = ₹720 contribution before period marketing.`

## Local setup

1. Install Node.js 22+ and npm.
2. Create a Supabase project.
3. Copy `.env.example` to `.env.local` and fill the secrets.
4. Apply `supabase/migrations/0001_initial.sql` and `0002_hardening.sql` in order.
5. Configure Supabase Auth email settings and redirect URLs.
6. Run `npm install`.
7. Run `npm run dev`.

### First platform admin

The seed script creates a test admin user with the `super_admin` membership. In a real deployment, create the first operator through your controlled onboarding process and assign a platform role using the Supabase SQL editor or an audited administration workflow.

## Verification commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The checked-in unit tests are deterministic. Live integration tests are environment-gated and require a dedicated non-production Supabase/provider test environment.

## Current verification status in this build environment

The package manager installation did not complete before the execution limit, so this environment did **not** produce a trustworthy `npm run lint`, `npm test`, or `npm run build` result. The source was nevertheless statically syntax-checked during packaging. Do not treat the repository as “verified green” until dependencies are installed and the four commands above pass in CI.

## Deployment

See `VERCEL_DEPLOYMENT.md` for the first deployment using Vercel + Supabase PostgreSQL/Auth/Storage.

See `HOSTING_MIGRATION.md` for migration to VPS/dedicated hosting without losing PostgreSQL or object-storage data.

See `API_INTEGRATIONS.md` for provider setup, callback URLs, scopes and operational behavior.

## Admin access and client credentials

The platform bootstrap supports these admin emails by default: `info@bb24.in` and `bigbrand24@gmail.com`. Set `SEED_ADMIN_PASSWORD` before running the seed script; it is never stored in application tables. Admin users are created with Supabase Auth on the trusted server side.

Admins can create client businesses from `/admin` with a login email and either provide a temporary password or let the server generate one. The password is returned once to the authenticated admin and is not written to `audit_logs`. Admins can also reset the active client login password from the client support view.

Supabase's admin user management APIs are server-only and require the secret/service key; never put that key in browser code. citeturn394013search2turn394013search4
