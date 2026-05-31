import { Save } from "lucide-react";
import { updateRoleDisplayLabelAction } from "@/app/admin/roles/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminRoles } from "@/lib/admin/admin-data";
import { requireUserPermission } from "@/lib/auth/guards";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requireUserPermission("admin.access");
  const [roles, roleDisplayLabels] = await Promise.all([getAdminRoles(), getRoleDisplayNameOverrides()]);

  return (
    <AdminShell
      title="Roles"
      description="System role map for Bouncecore account, admin, streaming, marketplace, commerce, and supporter access."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={role.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={roleBadgeTone(role.name)}>{roleDisplayName(role.name, roleDisplayLabels)}</Badge>
              <span className="text-xs font-semibold uppercase text-bc-muted">
                {role.permissions.length} permissions / {role._count.users} users
              </span>
            </div>
            <h3 className="mt-4 text-xl font-black">{roleDisplayName(role.name, roleDisplayLabels)}</h3>
            <p className="mt-2 text-sm text-bc-muted">{role.description}</p>
            <form action={updateRoleDisplayLabelAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input name="role" type="hidden" value={role.name} />
              <label className="grid gap-2 text-xs font-semibold uppercase text-bc-muted">
                Badge text
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm normal-case text-white"
                  defaultValue={roleDisplayName(role.name, roleDisplayLabels)}
                  maxLength={40}
                  minLength={2}
                  name="displayName"
                  required
                />
                <span className="text-xs normal-case text-bc-muted">Original role: {role.name}</span>
              </label>
              <div className="flex items-end">
                <Button size="sm" type="submit" variant="ghost">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </Button>
              </div>
            </form>
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
