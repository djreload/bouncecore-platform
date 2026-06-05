import { AdminMenusPanel } from "@/app/admin/menus/menus-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { getAdminSiteMenusData } from "@/lib/admin/site-design-service";

export const dynamic = "force-dynamic";

export default async function AdminMenusPage() {
  const data = await getAdminSiteMenusData();

  return (
    <AdminShell
      title="Menus"
      description="Manage public header labels, display order, and visibility."
      requiredPermission="site.manage"
    >
      <AdminMenusPanel data={data} />
    </AdminShell>
  );
}
