import { AdminPushPanel } from "@/app/admin/push/push-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminPushData } from "@/lib/admin/push-service";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  await requireUserPermission("mobile.manage");
  const data = await getAdminPushData();

  return (
    <AdminShell
      title="Push notifications"
      description="Send database-backed platform notifications to active users, roles, or a specific account."
    >
      <AdminPushPanel data={data} />
    </AdminShell>
  );
}
