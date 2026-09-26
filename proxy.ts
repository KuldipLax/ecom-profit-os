import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPaths = ["/dashboard", "/profit", "/orders", "/products", "/marketing", "/shipping", "/rto", "/cohorts", "/forecast", "/reports", "/settings", "/onboarding", "/admin", "/api"];

function copySupabaseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  ["cache-control", "expires", "pragma"].forEach((header) => {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  });
  return to;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isWebhookOrCron = pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/cron/");

  if (isProtected && !data.user && !isWebhookOrCron) {
    const redirect = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + request.nextUrl.search)}`, request.url));
    return copySupabaseCookies(response, redirect);
  }

  if ((pathname === "/login" || pathname === "/signup" || pathname === "/admin/login") && data.user) {
    const redirect = NextResponse.redirect(new URL(pathname === "/admin/login" ? "/admin" : "/dashboard", request.url));
    return copySupabaseCookies(response, redirect);
  }

  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
