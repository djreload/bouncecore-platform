import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProfileForm } from "@/app/streamer/profile/profile-form";
import { requireUserPermission } from "@/lib/auth/guards";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getStreamerProfileData } from "@/lib/profile/dj-profile-service";

export const dynamic = "force-dynamic";

export default async function StreamerProfilePage() {
  const user = await requireUserPermission("stream.dashboard");
  const [profileData, roleDisplayLabels] = await Promise.all([
    getStreamerProfileData(user.id),
    getRoleDisplayNameOverrides()
  ]);

  return (
    <DashboardShell
      mode="streamer"
      title="Public DJ profile"
      description="Edit the public DJ profile, directory visibility, profile slug, links, and creator bio shown to viewers."
    >
      <ProfileForm profileData={profileData} roleDisplayLabels={roleDisplayLabels} />
    </DashboardShell>
  );
}
