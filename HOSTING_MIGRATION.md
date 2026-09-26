# Hosting Migration: Vercel → VPS / Dedicated Host

The application is designed so Vercel is a deployment target, not a system of record.

## What remains in PostgreSQL

All business-critical data is in Supabase PostgreSQL:

- tenants and memberships
- orders / items
- products / variants
- COGS history
- shipping data
- marketing spend
- checkout/payment transactions
- snapshots
- jobs / logs / audit trail
- CSV import history

Export a PostgreSQL backup using `pg_dump` from the Supabase database, or the Supabase-supported backup/export workflow, then restore to a managed PostgreSQL instance on the destination host.

## Object storage

CSV uploads live in Supabase Storage, not the application filesystem. Copy the private `csv-imports` bucket to the destination object store before switching the application endpoint.

The application only stores the durable `storage_path` pointer in PostgreSQL.

## Environment variables

Move the same environment variables to the new host's secret manager. Keep them provider-neutral:

- database URL / Supabase URL
- public auth key
- server service key if Supabase remains in use
- encryption key
- provider OAuth credentials
- cron secret

Do not rotate `ENCRYPTION_KEY` until encrypted integration credentials have been migrated or re-encrypted deliberately.

## OAuth callback URLs

OAuth redirect URLs are environment-driven. Update:

- `NEXT_PUBLIC_APP_URL`
- Shopify callback/webhook URLs
- Meta callback URL

Then redeploy the app.

## Scheduled jobs

Replace Vercel Cron with one of:

- systemd timer
- cron + curl
- managed scheduler
- queue worker / job runner

Call:

`GET /api/cron/sync`

with the configured bearer `CRON_SECRET`.

## Zero-data-loss migration sequence

1. Freeze or pause high-write imports.
2. Take a PostgreSQL backup.
3. Copy Supabase Storage objects.
4. Provision the destination PostgreSQL and restore.
5. Deploy the application with the migrated environment variables.
6. Validate row counts and a sample of profit snapshots.
7. Validate login and tenant isolation.
8. Validate one provider connection and one sync.
9. Switch DNS / deployment traffic.
10. Resume scheduled sync.

Keep the old environment read-only until the first destination sync and reconciliation checks pass.
