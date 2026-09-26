import { describe, expect, it } from "vitest";
import { reconcileOrderSets } from "@/lib/reconciliation";
describe("reconciliation",()=>{it("deduplicates and classifies source vs target orders",()=>{const r=reconcileOrderSets(["1","1","2","3"],["1","2","4"],[]);expect(r.shopifyOrders).toBe(4);expect(r.uniqueOrders).toBe(3);expect(r.duplicates).toBe(1);expect(r.shippingMatched).toBe(2);expect(r.unmatched).toBe(1);});});
