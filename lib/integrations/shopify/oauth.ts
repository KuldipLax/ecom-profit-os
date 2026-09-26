import crypto from "node:crypto";
import { env } from "@/lib/env";
export function createShopifyState(businessId:string){return `${businessId}.${crypto.createHmac("sha256",env.SHOPIFY_CLIENT_SECRET??"").update(businessId).digest("hex")}`;}
export function verifyShopifyState(state:string){const [businessId,mac]=state.split(".");if(!businessId||!mac)return null;const expected=crypto.createHmac("sha256",env.SHOPIFY_CLIENT_SECRET??"").update(businessId).digest("hex");return mac.length===expected.length&&crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(expected))?businessId:null;}
