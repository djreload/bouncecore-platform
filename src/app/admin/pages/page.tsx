import { AdminPagesPanel } from "@/app/admin/pages/pages-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { getAdminSitePagesData } from "@/lib/admin/site-design-service";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const data = await getAdminSitePagesData();

  return (
    <AdminShell
      title="Pages"
      description="Manage public page titles, descriptions, visibility, and homepage feature cards."
      requiredPermission="site.manage"
    >
      <AdminPagesPanel data={data} />
    </AdminShell>
  );
}
