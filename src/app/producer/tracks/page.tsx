import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProducerTracksPanel } from "@/app/producer/tracks/tracks-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerWorkspaceData } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

export default async function ProducerTracksPage() {
  const user = await requireUserPermission("producer.dashboard");
  const data = await getProducerWorkspaceData(user.id);

  return (
    <DashboardShell
      mode="producer"
      title="My tracks"
      description="Create, edit, price, and manage approval status for producer digital tracks."
    >
      <ProducerTracksPanel data={data} />
    </DashboardShell>
  );
}
