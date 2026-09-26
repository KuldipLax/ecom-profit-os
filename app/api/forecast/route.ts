import { NextRequest, NextResponse } from "next/server";
import { resolveBusinessId } from "@/lib/auth/business-context";
import { calculateBusinessPeriodProfit, buildProfitInput, getForwardOrders, normalizeSettings } from "@/lib/profit-engine/server";
import { projectForwardOrders } from "@/lib/forecast-engine";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const businessId = await resolveBusinessId(q.get("businessId"));
    const end = q.get("end") ?? new Date().toISOString().slice(0, 10);
    const selectedStart = q.get("start") ?? end;
    const rollingEnd = end;
    const rollingStartDate = new Date(`${rollingEnd}T00:00:00Z`);
    rollingStartDate.setUTCDate(rollingStartDate.getUTCDate() - 29);
    const rollingStart = rollingStartDate.toISOString().slice(0, 10);
    const [actual, rolling30] = await Promise.all([
      calculateBusinessPeriodProfit(businessId, selectedStart, end),
      calculateBusinessPeriodProfit(businessId, rollingStart, rollingEnd),
    ]);
    const forward = await getForwardOrders(businessId, undefined, undefined, {}, normalizeSettings(actual.business.settings).forwardStatuses);
    const inputs = forward.map((row: any) => buildProfitInput(row, [], new Map()));
    const projection = projectForwardOrders(actual.result, inputs, normalizeSettings(actual.business.settings), rolling30.result.deliveryRate);
    return NextResponse.json({ ...projection, rolling30DeliveryRate: rolling30.result.deliveryRate });
  } catch {
    return NextResponse.json({ error: "Forecast could not be calculated." }, { status: 500 });
  }
}
