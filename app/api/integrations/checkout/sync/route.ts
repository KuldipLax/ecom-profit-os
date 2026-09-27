import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { resolveBusinessId } from "@/lib/auth/business-context";
import { syncRazorpayBusiness } from "@/lib/integrations/checkout/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await requireUser();
  const body = await request.json().catch(() => ({}));
  const id = await resolveBusinessId(body.businessId);
  if (body.provider !== "razorpay") return NextResponse.json({ error: "Live checkout sync is currently enabled for Razorpay only." }, { status: 409 });
  try {
    return NextResponse.json(await syncRazorpayBusiness(id, body.start, body.end));
  } catch {
    return NextResponse.json({ error: "Checkout sync failed. Retry sync." }, { status: 502 });
  }
}
