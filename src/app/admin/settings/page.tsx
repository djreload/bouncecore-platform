import { AdminSettingsPanel } from "@/app/admin/settings/settings-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { getAdminSiteSettingsData } from "@/lib/admin/site-settings-service";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const data = await getAdminSiteSettingsData();

  return (
    <AdminShell
      title="General settings"
      description="Manage public site copy, homepage announcement text, and core support details."
      requiredPermission="settings.manage"
    >
      <AdminSettingsPanel data={data} />
    </AdminShell>
  );
}
