import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStreamKeysPanel } from "@/app/admin/stream-keys/stream-keys-panel";
import type { AdminStreamKeyRow, AdminStreamKeyUserOption } from "@/app/admin/stream-keys/state";
import { getAdminStreamKeys, getAdminStreamKeyUsers } from "@/lib/admin/admin-data";
import { requireUserPermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminStreamKeysPage() {
  const actor = await requireUserPermission("stream.keys.manage.any");
  const [streamKeys, users] = await Promise.all([getAdminStreamKeys(), getAdminStreamKeyUsers()]);
  const keyRows: AdminStreamKeyRow[] = streamKeys.map((key) => ({
    id: key.id,
    fingerprint: key.fingerprint,
    status: key.status,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    userId: key.userId,
    userEmail: key.user.email,
    userDisplayName: key.user.displayName,
    userRoles: key.user.roles.map((userRole) => userRole.role.name)
  }));
  const userOptions: AdminStreamKeyUserOption[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles.map((userRole) => userRole.role.name),
    hasActiveKey: user.streamKeys.length > 0
  }));

  return (
    <AdminShell
      title="Stream keys"
      description="Owner and admin control room for creating, rotating, revoking, and auditing private stream keys."
    >
      <AdminStreamKeysPanel
        canRevealRawKeys={hasPermission(actor, "stream.keys.view.raw.any")}
        keys={keyRows}
        users={userOptions}
      />
    </AdminShell>
  );
}
