import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AccountProfileForm } from "@/app/account/profile/profile-form";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getAccountProfileData } from "@/lib/account/account-service";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const user = await requireSignedInUser();
  const [data, roleDisplayLabels] = await Promise.all([getAccountProfileData(user.id), getRoleDisplayNameOverrides()]);

  return (
    <DashboardShell title="Profile" description="Manage your Bouncecore display name, public profile, links, and visibility.">
      <AccountProfileForm data={data} roleDisplayLabels={roleDisplayLabels} />
    </DashboardShell>
  );
}
