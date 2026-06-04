import { AdminBansPanel } from "@/app/admin/bans/bans-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminBansData } from "@/lib/chat/moderation-service";

export const dynamic = "force-dynamic";

export default async function AdminBansPage() {
  await requireUserPermission("moderation.use");
  const data = await getAdminBansData();

  return (
    <AdminShell title="Bans" description="Create and revoke global or room-specific chat bans without disabling accounts.">
      <AdminBansPanel data={data} />
    </AdminShell>
  );
}
