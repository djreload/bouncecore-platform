import { AdminMobilePanel } from "@/app/admin/mobile/mobile-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminMobileConfigData } from "@/lib/admin/mobile-service";

export const dynamic = "force-dynamic";

export default async function AdminMobilePage() {
  await requireUserPermission("mobile.manage");
  const data = await getAdminMobileConfigData();

  return (
    <AdminShell title="App config" description="Database-backed mobile API feature flags, theme settings, and launch controls.">
      <AdminMobilePanel data={data} />
    </AdminShell>
  );
}
