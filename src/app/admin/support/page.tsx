import { AdminSupportPanel } from "@/app/admin/support/support-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { getAdminSupportRequestsData } from "@/lib/support/support-service";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const data = await getAdminSupportRequestsData();

  return (
    <AdminShell
      title="Support inbox"
      description="Review public support requests, track status, and keep an audit trail of customer help."
    >
      <AdminSupportPanel data={data} />
    </AdminShell>
  );
}
