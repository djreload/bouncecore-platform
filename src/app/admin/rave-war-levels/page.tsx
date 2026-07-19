import { AdminRaveWarLevelsPanel } from "@/app/admin/rave-war-levels/rave-war-levels-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminRaveWarLevelsData } from "@/lib/rave-wars/rave-war-level-service";

export const dynamic = "force-dynamic";

export default async function AdminRaveWarLevelsPage() {
  await requireUserPermission("settings.manage");
  const data = await getAdminRaveWarLevelsData();

  return (
    <AdminShell
      description="Upload destructible terrain, generate collision surfaces, preview spawn positions, and select the battlefield used by new Rave Wars."
      requiredPermission="settings.manage"
      title="Rave War levels"
    >
      <AdminRaveWarLevelsPanel data={data} />
    </AdminShell>
  );
}

