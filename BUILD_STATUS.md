# ECOM PROFIT OS — Build Status

## Implemented in source

The repository contains the requested Next.js/Supabase multi-tenant architecture, PostgreSQL migrations with RLS, email/password auth flow, Admin and Client areas, centralized calculation and forecast engines, Shopify/Meta/Shiprocket adapters, webhooks, scheduled sync route, durable CSV storage/import, manual order/checkout/adjustment entry, reconciliation, data health, audit logging, exports, responsive dashboard pages, seed data, and unit/integration-test suites.

## Automated verification

The latest GitHub Actions CI run for the current `main` head completed successfully with:

- `npm install --no-audit --no-fund`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

The lint job reports 0 errors; the repository may still emit non-blocking warnings from the configured Next.js/ESLint rules.

## Static security/source checks

- No permanent-data use of `localStorage`, `sessionStorage`, SQLite, project JSON storage, or filesystem writes in application source.
- Server-only provider credentials, Supabase service-role credentials, encryption keys, webhook secrets and cron secrets are not referenced from `use client` modules.
- Admin global platform settings are restricted to `super_admin` in both page/API authorization and the database policy.
- Supabase migrations must be applied in order through `0003_security_hardening.sql`; stopping after `0002` leaves its temporary broad admin scope in place.

## Live integration verification

Provider calls are configuration-gated and are not simulated. Shopify, Meta Ads, and Shiprocket require provider credentials, callback/webhook configuration, and a real non-production test tenant before live synchronization can be verified. Checkout remains `not_configured` unless a provider adapter is added; manual/CSV data entry is the supported fallback.

## Current implementation notes

- Admin client creation creates a real Supabase Auth user, creates the business, assigns the `client` membership, initializes integration records, and returns a one-time generated temporary password to the authenticated admin.
- Admin client reset updates the real Supabase Auth user without persisting the plaintext password in application tables or audit logs.
- Deactivating a client disables client memberships; reactivating restores them.
- Initial seed businesses include GS Ayurvedic, Rudraaye, Vedixam, and Grendexherbs.
- Live integration tests remain explicitly environment-gated and are not a substitute for a dedicated staging provider test environment.
