import { describe, expect, it } from "vitest";
import { projectForwardOrders } from "@/lib/forecast-engine";

const settings={treatPrepaidAsEffectiveDelivered:true,checkoutFee:{method:"percentage",percentage:0.02,flatFee:0,minimumFee:null,maximumFee:null},pgFee:{method:"percentage",percentage:0.02,flatFee:0},metaGstRate:0.18,shippingRule:"max"} as const;
const actual:any={grossSale:10000,netSaleShipped:10000,deliveredRevenue:6250,netProfit:2500,orders:10,shipped:10,effectiveDelivered:6,effectiveDeliveredUnits:6,rto:3,open:1,deliveryRate:.625,rtoRate:.3,cogs:1400,shipping:1000,checkout:200,pg:100,metaSpend:1000,metaGst:180,effectiveMarketingCost:1180,roas:5.2966,profitMargin:.4,aov:1000,profitPerDeliveredOrder:416.67,marketingCostPerDeliveredOrder:196.67,orderEconomics:[]};
const forward=Array.from({length:38},(_,i)=>({orderId:`f${i}`,orderNumber:`F${i}`,orderDate:"2026-09-25T00:00:00Z",grossSale:1000,refundedAmount:0,paymentMethod:"cod" as const,status:"IN_TRANSIT",lines:[{quantity:1,unitCost:140}]}));

describe("forecast engine",()=>{
  it("projects from the supplied rolling delivery rate",()=>{
    const p=projectForwardOrders(actual,forward,settings,.625);
    expect(p.estimateOnly).toBe(true);
    expect(p.forwardOrders).toBe(38);
    expect(p.estimatedDelivered).toBeCloseTo(23.75);
    expect(p.estimatedRto).toBeCloseTo(14.25);
    expect(p.projectedRevenue).toBeCloseTo(23750);
    expect(p.estimatedRtoValue).toBeCloseTo(14250);
    expect(p.projectedAdditionalProfit).toBeCloseTo(9211.8333,3);
  });
});
