import { AdminShell } from "@/components/layout/admin-shell";
import { AdminTracksPanel } from "@/app/admin/tracks/tracks-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminProducerApprovalsData } from "@/lib/music/admin-music-service";

export const dynamic = "force-dynamic";

export default async function AdminProducerApprovalsPage() {
  await requireUserPermission("music.manage");
  const data = await getAdminProducerApprovalsData();

  return (
    <AdminShell title="Producer approvals" description="Review pending producer track submissions before they go live.">
      <AdminTracksPanel data={data} mode="approvals" />
    </AdminShell>
  );
}
