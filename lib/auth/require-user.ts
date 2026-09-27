import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "super_admin" | "admin" | "client" | "analyst";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function getMemberships(userId?: string) {
  const u = userId ? { id: userId } : await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id,business_id,role,status,businesses(id,name,slug,currency,timezone,status,settings)")
    .eq("user_id", u.id)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((m: any) => Boolean(m.businesses));
}

export async function requireBusinessAccess(businessId: string, roles?: AppRole[]) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership, error } = await supabase
    .from("memberships")
    .select("role,status,businesses(id,name,slug,currency,timezone,status,settings)")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (membership?.businesses) {
    const role = membership.role as AppRole;
    if (roles && !roles.includes(role)) throw new Error("Business access denied.");
    return { user, role, business: membership.businesses };
  }

  if (roles && !roles.includes("super_admin")) throw new Error("Business access denied.");

  const { data: superAdminMemberships, error: ae } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("role", "super_admin");

  if (ae) throw new Error(ae.message);
  if (!(superAdminMemberships ?? []).length) throw new Error("Business access denied.");

  const { data: business, error: be } = await supabase
    .from("businesses")
    .select("id,name,slug,currency,timezone,status,settings")
    .eq("id", businessId)
    .maybeSingle();

  if (be || !business) throw new Error("Business access denied.");

  return { user, role: "super_admin" as AppRole, business };
}

export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("business_id,role,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  if (!(data ?? []).some((m) => m.role === "super_admin" || m.role === "admin")) redirect("/dashboard");
  return { user, memberships: data ?? [] };
}
