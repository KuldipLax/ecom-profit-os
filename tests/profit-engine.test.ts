import { describe, expect, it } from "vitest";
import { calculateOrderEconomics, calculatePeriodProfit } from "@/lib/profit-engine/calculation";

const settings={treatPrepaidAsEffectiveDelivered:true,checkoutFee:{method:"percentage",percentage:0.02,flatFee:0,minimumFee:null,maximumFee:null},pgFee:{method:"percentage",percentage:0.02,flatFee:0},metaGstRate:0.18,shippingRule:"max"} as const;
const base={orderId:"o1",orderNumber:"1001",orderDate:"2026-09-20T10:00:00Z",grossSale:1000,refundedAmount:0,paymentMethod:"prepaid" as const,status:"DELIVERED",lines:[{quantity:1,unitCost:140}],shipping:{applicable:true,totalFreight:100,unbilledCharges:60}};

describe("central profit engine",()=>{
 it("matches critical contribution before marketing through the real engine",()=>expect(calculateOrderEconomics(base,settings).contributionBeforeMarketing).toBe(720));
 it("uses MAX(freight, unbilled) shipping",()=>expect(calculateOrderEconomics({...base,status:"DELIVERED"},settings).shipping).toBe(100));
 it("does not add unbilled charges on top of freight",()=>expect(calculateOrderEconomics({...base,shipping:{applicable:true,totalFreight:100,unbilledCharges:150}},settings).shipping).toBe(150));
 it("treats prepaid as effective delivered when enabled",()=>expect(calculateOrderEconomics({...base,status:"SHIPPED"},settings).effectiveStatus).toBe("EFFECTIVE_DELIVERED"));
 it("tracks effective-delivered units for period calculations",()=>expect(calculatePeriodProfit([{...base,lines:[{quantity:3,unitCost:140}]}],settings).effectiveDeliveredUnits).toBe(3));
 it("does not treat RTO as delivered",()=>{const x=calculateOrderEconomics({...base,status:"RTO_DELIVERED"},settings);expect(x.effectiveDelivered).toBe(false);expect(x.deliveredRevenue).toBe(0);expect(x.effectiveStatus).toBe("RTO")});
 it("does not charge prepaid PG fee to COD",()=>{const x=calculateOrderEconomics({...base,paymentMethod:"cod"},settings);expect(x.pgFee).toBe(0)});
 it("applies Meta GST exactly once at period level",()=>{const r=calculatePeriodProfit([base],settings,10000);expect(r.metaSpend).toBe(10000);expect(r.metaGst).toBe(1800);expect(r.effectiveMarketingCost).toBe(11800);expect(r.netProfit).toBeLessThan(-1)});
 it("excludes cancelled orders from delivered revenue",()=>{const x=calculateOrderEconomics({...base,status:"CANCELLED"},settings);expect(x.deliveredRevenue).toBe(0);expect(x.effectiveStatus).toBe("CANCELLED")});
 it("supports refunds without changing historical source values",()=>{const x=calculateOrderEconomics({...base,refundedAmount:100},settings);expect(x.deliveredRevenue).toBe(900);expect(x.refundAdjustment).toBe(100)});
});
