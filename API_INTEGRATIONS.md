# API Integration Guide

## Environment

All provider secrets are server-side only. Never put service-role keys, provider client secrets, bearer tokens or `ENCRYPTION_KEY` in `NEXT_PUBLIC_*` variables.

## Shopify

The app uses Shopify's Admin GraphQL API. Configure a Shopify app with:

- Client ID / secret
- Redirect URL: `${NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`
- Webhook callback URL: `${NEXT_PUBLIC_APP_URL}/api/webhooks/shopify`
- Required scopes: configured with `SHOPIFY_SCOPES`

The app stores the offline access token encrypted. Initial sync fetches orders and their line items; repeat sync upserts by business + provider + source order ID and also preserves unique order number. The webhook endpoint validates the Shopify HMAC, records the event and queues a safe follow-up sync.

Current configuration defaults to Shopify API version `2026-07`; update `SHOPIFY_API_VERSION` through environment configuration as supported versions advance.

## Meta Ads

Configure a Meta app with:

- App ID / secret
- Redirect URL: `${NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`
- Permissions represented by `META_SCOPES`
- A `META_API_VERSION`

OAuth discovers accessible ad accounts and stores the token encrypted. Daily ad-level insight rows are keyed by date + ad account + campaign + ad set + ad. Repeated sync is idempotent.

The application stores provider spend as raw Meta spend. GST is calculated by the shared accounting engine.

## Shiprocket

Configure the Shiprocket API-user email and password. The adapter authenticates against the external API and normalizes shipment rows into the common `shipping_orders` schema.

The shipping layer is abstracted behind `ShippingProviderAdapter`, so future Delhivery/Xpressbees/Blue Dart adapters should implement the same normalization contract rather than duplicating P&L rules. Shiprocket tracking updates are accepted through the webhook route and authenticated with `SHIPROCKET_WEBHOOK_SECRET` against the provider webhook header; events are stored idempotently before order status processing.

## Checkout/payment

There is a `CheckoutProviderAdapter` interface. When a direct provider integration is not available, the Settings page exposes a durable manual transaction form and Reports exposes secure CSV import. The system does not create synthetic provider data.

Payment gateway cost rules are configurable. A provider integration may populate `payment_transactions` when its API is implemented.

## CSV

Endpoint: `POST /api/csv/import`

Form fields:

- `businessId`
- `provider`: `shopify | shiprocket | checkout | custom`
- `mode`: `preview | import`
- `file`
- `mapping` JSON during import

Files are written to the private `csv-imports` Supabase Storage bucket under `<businessId>/<importId>/...`.

## Background sync

Endpoint: `GET /api/cron/sync`

Authorization:

`Authorization: Bearer ${CRON_SECRET}`

Vercel invokes this on the schedule configured in `vercel.json`; the default is daily for Vercel Hobby compatibility. The endpoint loads configured integrations and runs provider sync adapters. Each sync records `sync_jobs` and updates integration state to `connected`, `syncing` or `failed`.

## Error behavior

Client-facing API errors use actionable language such as:

- Shopify connection expired. Reconnect Shopify.
- Shipping sync failed. Retry sync.
- Meta account permission expired.
- CSV validation failed; inspect the import summary.

Detailed provider errors remain in server-side sync logs and audit records.
