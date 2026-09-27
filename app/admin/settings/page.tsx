import { AppShell } from "@/components/dashboard/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformSettingsForm } from "@/components/forms/platform-settings-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("key,value,updated_at,updated_by")
    .order("key");

  return (
    <AppShell title="Global settings" role="admin">
      <PageHeader
        title="Global platform settings"
        description="Defaults for new businesses and platform feature flags. Business-specific rules remain in the tenant settings."
      />
      <PlatformSettingsForm rows={data ?? []} />
    </AppShell>
  );
}
