import { NotificationPreferencesForm } from "@/app/account/settings/notification-preferences-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getUserNotificationPreferences } from "@/lib/account/notification-preferences-service";

export const dynamic = "force-dynamic";

export default async function AccountPreferencesPage() {
  const user = await requireSignedInUser();
  const preferences = await getUserNotificationPreferences(user.id);

  return (
    <DashboardShell
      title="Notification delivery"
      description="Choose which notification categories may be delivered by email and Android push. In-site inbox notifications remain available separately."
    >
      <NotificationPreferencesForm preferences={preferences} />
    </DashboardShell>
  );
}
