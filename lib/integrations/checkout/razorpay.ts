import { fetchWithRetry } from "@/lib/integrations/http";
import type { CheckoutTransaction } from "./index";

export class RazorpayAdapter {
  readonly name = "razorpay";
  constructor(private keyId: string, private keySecret: string) {}

  private auth() {
    return Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }

  async listTransactions(from: string, to: string): Promise<CheckoutTransaction[]> {
    const base = "https://api.razorpay.com/v1/payments";
    const rows: CheckoutTransaction[] = [];
    const fromTs = Math.floor(new Date(from).getTime() / 1000);
    const toTs = Math.floor(new Date(to).getTime() / 1000);
    for (let skip = 0; skip < 10000; skip += 100) {
      const url = new URL(base);
      url.searchParams.set("from", String(fromTs));
      url.searchParams.set("to", String(toTs));
      url.searchParams.set("count", "100");
      url.searchParams.set("skip", String(skip));
      const response = await fetchWithRetry(url, {
        headers: { Authorization: `Basic ${this.auth()}`, Accept: "application/json" },
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error?.description || "Razorpay payment sync failed.");
      const items = Array.isArray(json?.items) ? json.items : [];
      rows.push(...items.map((item: any) => ({
        externalTransactionId: String(item.id),
        orderNumber: item.order_id ? String(item.order_id) : "",
        transactionDate: new Date(Number(item.created_at ?? 0) * 1000).toISOString(),
        paymentMethod: /cod/i.test(String(item.method ?? "")) ? "cod" : "prepaid",
        paymentStatus: String(item.status ?? "unknown"),
        transactionValue: Number(item.amount ?? 0) / 100,
        checkoutFee: item.fee != null ? Number(item.fee) / 100 : null,
      })));
      if (items.length < 100) break;
    }
    return rows;
  }
}
