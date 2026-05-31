import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { getAdminRoles } from "@/lib/admin/admin-data";
import { requireUserPermission } from "@/lib/auth/guards";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requireUserPermission("admin.access");
  const roles = await getAdminRoles();

  return (
    <AdminShell
      title="Roles"
      description="System role map for Bouncecore account, admin, streaming, marketplace, commerce, and supporter access."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={role.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={roleBadgeTone(role.name)}>{roleDisplayName(role.name)}</Badge>
              <span className="text-xs font-semibold uppercase text-bc-muted">
                {role.permissions.length} permissions / {role._count.users} users
              </span>
            </div>
            <h3 className="mt-4 text-xl font-black">{roleDisplayName(role.name)}</h3>
            <p className="mt-2 text-sm text-bc-muted">{role.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {role.permissions.length ? (
                role.permissions.map(({ permission }) => (
                  <Badge key={permission.id} tone="muted">
                    {permission.key}
                  </Badge>
                ))
              ) : (
                <Badge tone="muted">Public/account defaults</Badge>
              )}
            </div>
          </article>
        ))}
        {!roles.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Badge tone="muted">Empty</Badge>
            <p className="mt-3 text-sm text-bc-muted">No roles are seeded yet.</p>
          </article>
        ) : null}
      </div>
    </AdminShell>
  );
}
