import Decimal from "decimal.js";
export type CogsRecord={scope:"variant"|"product"|"category"|"default";variantId?:string|null;productId?:string|null;category?:string|null;costPerUnit:number|string;effectiveFrom:string};
const rank=(scope:CogsRecord["scope"])=>({variant:1,product:2,category:3,default:4}[scope]);
export function resolveCogs(records:CogsRecord[],query:{variantId?:string|null;productId?:string|null;category?:string|null;orderDate:string}){const eligible=records.filter(r=>r.effectiveFrom<=query.orderDate&&((r.scope==="variant"&&r.variantId===query.variantId)||(r.scope==="product"&&r.productId===query.productId)||(r.scope==="category"&&r.category===query.category)||(r.scope==="default"))).sort((a,b)=>rank(a.scope)-rank(b.scope)||b.effectiveFrom.localeCompare(a.effectiveFrom));return eligible[0]?new Decimal(eligible[0].costPerUnit):new Decimal(0);}
export function criticalTestContribution(){return new Decimal(1000).minus(140).minus(20).minus(20).minus(100).toNumber();}
