import { z } from "zod";

const envValue = (name: string) => {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value;
};

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().default("2026-07"),
  SHOPIFY_SCOPES: z.string().default("read_orders,read_all_orders,read_products,read_fulfillments"),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_API_VERSION: z.string().optional(),
  META_SCOPES: z.string().default("ads_read,business_management"),
  SHIPROCKET_API_USER_EMAIL: z.string().optional(),
  SHIPROCKET_API_USER_PASSWORD: z.string().optional(),
  SHIPROCKET_CLIENT_ID: z.string().optional(),
  SHIPROCKET_CLIENT_SECRET: z.string().optional(),
  SHIPROCKET_WEBHOOK_SECRET: z.string().optional(),
  SHIPROCKET_BASE_URL: z.string().url().default("https://apiv2.shiprocket.in/v1/external"),
  ENCRYPTION_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(120),
  DEFAULT_META_GST_RATE: z.coerce.number().min(0).default(.18),
  DEFAULT_CHECKOUT_FEE_RATE: z.coerce.number().min(0).default(.02),
  DEFAULT_PREPAID_PG_FEE_RATE: z.coerce.number().min(0).default(.02),
  DEFAULT_FORECAST_DELIVERY_RATE_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
});

export const env = schema.parse({
  NEXT_PUBLIC_APP_URL: envValue("NEXT_PUBLIC_APP_URL"),
  NEXT_PUBLIC_SUPABASE_URL: envValue("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_URL: envValue("SUPABASE_URL") ?? envValue("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON_KEY: envValue("SUPABASE_ANON_KEY") ?? envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: envValue("SUPABASE_SERVICE_ROLE_KEY"),
  SHOPIFY_CLIENT_ID: envValue("SHOPIFY_CLIENT_ID"),
  SHOPIFY_CLIENT_SECRET: envValue("SHOPIFY_CLIENT_SECRET"),
  SHOPIFY_API_VERSION: envValue("SHOPIFY_API_VERSION"),
  SHOPIFY_SCOPES: envValue("SHOPIFY_SCOPES"),
  SHOPIFY_WEBHOOK_SECRET: envValue("SHOPIFY_WEBHOOK_SECRET"),
  META_APP_ID: envValue("META_APP_ID"),
  META_APP_SECRET: envValue("META_APP_SECRET"),
  META_API_VERSION: envValue("META_API_VERSION"),
  META_SCOPES: envValue("META_SCOPES"),
  SHIPROCKET_API_USER_EMAIL: envValue("SHIPROCKET_API_USER_EMAIL"),
  SHIPROCKET_API_USER_PASSWORD: envValue("SHIPROCKET_API_USER_PASSWORD"),
  SHIPROCKET_CLIENT_ID: envValue("SHIPROCKET_CLIENT_ID"),
  SHIPROCKET_CLIENT_SECRET: envValue("SHIPROCKET_CLIENT_SECRET"),
  SHIPROCKET_WEBHOOK_SECRET: envValue("SHIPROCKET_WEBHOOK_SECRET"),
  SHIPROCKET_BASE_URL: envValue("SHIPROCKET_BASE_URL"),
  ENCRYPTION_KEY: envValue("ENCRYPTION_KEY"),
  CRON_SECRET: envValue("CRON_SECRET"),
  RATE_LIMIT_REQUESTS_PER_MINUTE: envValue("RATE_LIMIT_REQUESTS_PER_MINUTE"),
  DEFAULT_META_GST_RATE: envValue("DEFAULT_META_GST_RATE"),
  DEFAULT_CHECKOUT_FEE_RATE: envValue("DEFAULT_CHECKOUT_FEE_RATE"),
  DEFAULT_PREPAID_PG_FEE_RATE: envValue("DEFAULT_PREPAID_PG_FEE_RATE"),
  DEFAULT_FORECAST_DELIVERY_RATE_WINDOW_DAYS: envValue("DEFAULT_FORECAST_DELIVERY_RATE_WINDOW_DAYS"),
});

export function requireServerSecret(name: "SUPABASE_SERVICE_ROLE_KEY" | "ENCRYPTION_KEY" | "CRON_SECRET") {
  const value = env[name];
  if (!value) throw new Error(`${name} is not configured on the server.`);
  return value;
}
