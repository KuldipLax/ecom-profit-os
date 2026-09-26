import crypto from "node:crypto";
export function hmacSha256Base64(secret:string,value:string){return crypto.createHmac("sha256",secret).update(value).digest("base64");}
export function timingSafeEqualString(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);}
