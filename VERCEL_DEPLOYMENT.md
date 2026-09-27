# Vercel Deployment

Target architecture: **Vercel + Supabase PostgreSQL + Supabase Auth + Supabase Storage**.

## 1. Create a GitHub repo

Create a private or organization repository and push this project.

## 2. Import into Vercel

Import the GitHub repository in Vercel. The project is a standard Next.js app.

## 3. Create Supabase

Create a Supabase project. Record:

- Project URL
- Publishable/anon key
- Service role key

## 4. Create the database

In Supabase SQL Editor, execute:

1. `supabase/migrations/0001_initial.sql`
2. `supabase/migrations/0002_hardening.sql`
3. `supabase/migrations/0003_security_hardening.sql`

They create the tables, indexes, roles, RLS policies, Storage bucket and onboarding function.

## 5. Configure Auth

Enable email/password authentication. Configure:

- Site URL = `NEXT_PUBLIC_APP_URL`
- Redirect URLs for `/reset-password`
- Production HTTPS domain(s)

## 6. Add Vercel environment variables

Copy values from `.env.example` into Vercel Project Settings → Environment Variables.

Required first-deployment variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `CRON_SECRET`

Add provider credentials only after the corresponding apps/accounts have been created.

## 7. Add Supabase keys to Vercel

Use the publishable/anon key for the browser/SSR client. The service-role key stays server-only.

## 8. Configure OAuth callback URLs

Shopify:

`https://<your-domain>/api/integrations/shopify/callback`

Meta:

`https://<your-domain>/api/integrations/meta/callback`

## 9. Configure Shopify

Set the app redirect URL and webhook URL from `API_INTEGRATIONS.md`. Use the configured current Admin API version; this project defaults to `2026-07`.

## 10. Configure Meta

Set the Meta OAuth callback and approved permissions. Populate `META_API_VERSION`.

## 11. Configure Shiprocket

Set the API-user credentials in Vercel environment variables or connect them through the business Settings UI. Business-specific credentials are encrypted before persistence.

## 12. Deploy

Push to GitHub and deploy from Vercel.

## 13. Test login

Test:

- signup
- email verification
- login
- forgot password
- reset password
- logout/login persistence

## 14. Test database persistence

Create a business and manual order. Refresh, log out, log back in, and verify the records remain in PostgreSQL.

## 15. Test integration connection

Connect one real sandbox/test provider account at a time. Never paste production secrets into browser-side code.

## 16. Test data sync

Run `Sync Now` from Settings and confirm the integration timestamp and `sync_jobs` row.

## 17. Test recalculation

As an admin, use the client support view to recalculate a period and verify a `profit_snapshots` row with `calculation_version`.

## 18. Test logout/login persistence

Verify that the tenant, orders, costs, imports and integrations are still present after a new browser session.

## 19. Vercel Cron

`vercel.json` schedules `/api/cron/sync` daily at 02:00 UTC so the default project is compatible with Vercel Hobby cron limits. On Vercel Pro, change the expression to hourly if desired. Configure `CRON_SECRET` and verify a successful cron invocation in Vercel logs.

## Production checklist

Before using live financial reporting:

- Run `npm run lint`
- Run `npm run typecheck`
- Run `npm test`
- Run `npm run build`
- Apply migrations to a staging Supabase project first
- Execute the reconciliation suite with representative data
- Connect each provider only after scopes/callbacks are validated
- Back up the database and storage before first production import
