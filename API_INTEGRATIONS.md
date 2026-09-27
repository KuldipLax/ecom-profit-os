# API Integration Guide

## Security

Provider credentials are sent only to server-side routes and stored encrypted in `integration_accounts.credentials_encrypted`. Never place provider secrets, Supabase service-role credentials or `ENCRYPTION_KEY` in `NEXT_PUBLIC_*` variables.

Settings → Connections keeps each integration card collapsed until the user opens it. A successful manual save shows a green **Saved** state. A provider is only marked **connected** when its live connection test succeeds; providers without a live adapter remain saved but are not falsely presented as synced.

## Shopify

### Automatic

The normal standalone-app path redirects the merchant to Shopify, exchanges the authorization code for an Admin API access token, stores it encrypted and enables background sync.

Configure server-side:

- Shopify Client ID / secret
- Redirect URL: `${NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`
- Webhook callback URL: `${NEXT_PUBLIC_APP_URL}/api/webhooks/shopify`
- Required Admin API scopes through the Shopify app configuration

### Manual

The dashboard accepts:

- Store domain
- Admin API access token
- Optional webhook secret

The **Test Connection** action calls the store's Admin GraphQL API before save. Shopify access tokens are scoped credentials and are sent in the `X-Shopify-Access-Token` header. The manual flow is intended for an existing/custom merchant app token; it is not a replacement for Shopify app OAuth on arbitrary third-party stores.

## Meta Ads

### Automatic

The platform OAuth flow discovers accessible ad accounts. After authorization, the dashboard can select which ad accounts to include in sync.

Configure server-side:

- Meta App ID / secret
- Callback URL: `${NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`
- Meta API version
- Requested permissions

### Manual

The dashboard accepts:

- Access token
- One or more ad account IDs

**Test Connection** calls Meta's accessible-ad-accounts endpoint and checks that the requested IDs are available before saving.

## Shipping & logistics

The dashboard is provider-agnostic. Available setup cards include:

- Shiprocket
- Delhivery
- Xpressbees
- Ecom Express
- Blue Dart
- DTDC

Provider credentials vary by account. The UI therefore exposes provider-specific labels for common fields and stores the complete credential payload encrypted.

### Shiprocket live adapter

Shiprocket is currently supported for live API authentication and background shipment sync. Its documented flow is: create an API user, obtain API credentials, authenticate against the Shiprocket authentication API, then use the bearer token for subsequent calls. Tracking webhooks use the provider's webhook URL and security token.

### Other couriers

Delhivery, Xpressbees, Ecom Express, Blue Dart and DTDC can be saved as manual configurations and can receive provider webhook events through the generated per-business endpoint. A live polling/sync adapter is enabled only after the exact provider API contract is implemented; the UI never labels a saved-but-untested provider as connected.

Webhook endpoint pattern:

`POST ${NEXT_PUBLIC_APP_URL}/api/webhooks/shipping/{provider}/{businessId}`

The webhook secret is stored encrypted. Provider-specific signature formats still need to be respected; the generic endpoint supports shared-secret/header patterns and safely records unrecognized payloads.

## Checkout & payments

Supported configuration cards:

- Razorpay
- Cashfree
- PayU
- PhonePe

The dashboard exposes API credential fields, environment selection, webhook secret and a copyable webhook URL.

### Razorpay live adapter

Razorpay API credentials are tested using Basic Authentication and the payment API. The adapter can also pull payment transactions into `payment_transactions`. The sync job matches a returned provider order ID to either `orders.external_order_id` or `orders.order_number` when a match exists.

Webhook endpoint pattern:

`POST ${NEXT_PUBLIC_APP_URL}/api/webhooks/checkout/{provider}/{businessId}`

For Razorpay, the webhook body is validated with HMAC-SHA256 using the webhook secret before it is accepted.

Cashfree, PayU and PhonePe are currently **manual-configuration ready** but do not receive a fake "connected" status until a dedicated live transaction adapter is added.

## Manual checkout fallback

The existing durable manual transaction form remains available for any payment provider while its direct API adapter is unavailable. CSV import remains available through Reports.

## Background sync

Endpoint: `GET /api/cron/sync`

Authorization:

`Authorization: Bearer ${CRON_SECRET}`

The scheduler runs connected Shopify, Meta, Shiprocket and Razorpay integrations and persists sync jobs plus daily aggregates.

## Data model

All provider adapters normalize their data into shared tables:

- Orders / order items
- Shipping orders / shipping events
- Marketing accounts / marketing spend
- Payment transactions / checkout transactions
- Webhook events
- Sync jobs / sync logs
- Audit logs

This keeps the profitability engine independent of the provider name.
