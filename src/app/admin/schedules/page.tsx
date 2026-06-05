import { AdminSchedulesPanel } from "@/app/admin/schedules/schedules-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getAdminStreamSchedulesData } from "@/lib/stream/stream-schedule-service";

export const dynamic = "force-dynamic";

export default async function AdminSchedulesPage() {
  await requireUserPermission("stream.settings.manage");
  const [data, roleDisplayLabels] = await Promise.all([getAdminStreamSchedulesData(), getRoleDisplayNameOverrides()]);

  return (
    <AdminShell
      title="Schedules"
      description="Plan stream slots, assign hosts, and keep upcoming live sessions visible to the control room."
    >
      <AdminSchedulesPanel
        channels={data.channels}
        hosts={data.hosts}
        roleDisplayLabels={roleDisplayLabels}
        schedules={data.schedules}
        stats={data.stats}
      />
    </AdminShell>
  );
}
