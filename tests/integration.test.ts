import { describe, expect, it } from "vitest";
const enabled=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY);
describe.skipIf(!enabled)("live integration contract tests",()=>{
 it("requires a configured Supabase test project",()=>expect(enabled).toBe(true));
 it.todo("authenticate signup/login/reset password against isolated test project");
 it.todo("verify tenant isolation across two businesses");
 it.todo("persist order + cost + integration rows after a fresh client session");
 it.todo("run Shopify/Shiprocket/Meta adapter tests with provider test credentials");
 it.todo("upload and import representative CSV fixtures");
});
