import { AdminSpinWheelsPanel } from "@/app/admin/spin-wheels/spin-wheels-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminSpinWheelsData } from "@/lib/rewards/prize-service";

export const dynamic = "force-dynamic";

export default async function AdminSpinWheelsPage() {
  await requireUserPermission("rewards.manage");
  const data = await getAdminSpinWheelsData();

  return (
    <AdminShell
      title="Spin wheels"
      description="Configure reward wheels and weighted prize segments before any public spin flow is enabled."
    >
      <AdminSpinWheelsPanel data={data} />
    </AdminShell>
  );
}
