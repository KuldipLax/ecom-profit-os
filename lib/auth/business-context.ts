import { redirect } from "next/navigation";
import { getMemberships } from "@/lib/auth/require-user";
export async function resolveBusinessId(requested?:string|null){const memberships=await getMemberships();if(requested){const found=memberships.find(m=>m.business_id===requested);if(found)return requested;}if(memberships[0]?.business_id)return memberships[0].business_id;redirect("/onboarding");}
export async function getBusinessContext(requested?:string|null){const memberships=await getMemberships();const selected=requested?memberships.find(m=>m.business_id===requested):memberships[0];if(!selected)redirect("/onboarding");return {businessId:selected.business_id,role:selected.role as any,business:selected.businesses};}
