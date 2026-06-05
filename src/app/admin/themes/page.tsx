import { AdminThemesPanel } from "@/app/admin/themes/themes-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { getAdminSiteThemeData } from "@/lib/admin/site-design-service";

export const dynamic = "force-dynamic";

export default async function AdminThemesPage() {
  const data = await getAdminSiteThemeData();

  return (
    <AdminShell
      title="Themes"
      description="Manage active Bouncecore colour tokens used by public, account, workspace, and admin shells."
      requiredPermission="site.manage"
    >
      <AdminThemesPanel data={data} />
    </AdminShell>
  );
}
