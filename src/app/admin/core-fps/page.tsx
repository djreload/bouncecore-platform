import { AdminCoreFpsPanel } from "@/app/admin/core-fps/core-fps-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { getAdminCoreFpsData } from "@/lib/games/core-fps-settings-service";

export const dynamic = "force-dynamic";

export default async function AdminCoreFpsPage() {
  const data = await getAdminCoreFpsData();

  return (
    <AdminShell
      description="Configure the isolated Core FPS origin, signed player access, and public launcher."
      requiredPermission="settings.manage"
      title="Core FPS"
    >
      <AdminCoreFpsPanel data={data} />
    </AdminShell>
  );
}
