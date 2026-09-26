import crypto from "node:crypto";
import { env } from "@/lib/env";
export function createMetaState(businessId:string){return `${businessId}.${crypto.createHmac("sha256",env.META_APP_SECRET??"").update(businessId).digest("hex")}`;}
export function verifyMetaState(state:string){const [id,mac]=state.split(".");if(!id||!mac)return null;const expected=crypto.createHmac("sha256",env.META_APP_SECRET??"").update(id).digest("hex");return mac.length===expected.length&&crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(expected))?id:null;}
