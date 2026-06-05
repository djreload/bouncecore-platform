import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProducerProfileForm } from "@/app/producer/profile/profile-form";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerWorkspaceData } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

export default async function ProducerProfilePage() {
  const user = await requireUserPermission("producer.dashboard");
  const data = await getProducerWorkspaceData(user.id);

  return (
    <DashboardShell
      mode="producer"
      title="Producer profile"
      description="Manage the public producer identity used across the Bouncecore music catalogue."
    >
      <ProducerProfileForm data={data} />
    </DashboardShell>
  );
}
