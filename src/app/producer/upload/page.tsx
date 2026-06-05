import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProducerTracksPanel } from "@/app/producer/tracks/tracks-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerWorkspaceData } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

export default async function ProducerUploadPage() {
  const user = await requireUserPermission("producer.dashboard");
  const data = await getProducerWorkspaceData(user.id);

  return (
    <DashboardShell
      mode="producer"
      title="Upload track"
      description="Add a track record with metadata, BPM, musical key, price, and approval status."
    >
      <ProducerTracksPanel data={data} mode="create" />
    </DashboardShell>
  );
}
