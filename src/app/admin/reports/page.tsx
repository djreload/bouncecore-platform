import { AdminReportsPanel } from "@/app/admin/reports/reports-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminReportsData } from "@/lib/chat/moderation-service";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  await requireUserPermission("moderation.use");
  const data = await getAdminReportsData();

  return (
    <AdminShell title="Reports" description="Review user-submitted chat reports, hide messages, and track moderation outcomes.">
      <AdminReportsPanel data={data} />
    </AdminShell>
  );
}
