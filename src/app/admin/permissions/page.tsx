import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { getAdminPermissions } from "@/lib/admin/admin-data";
import { requireUserPermission } from "@/lib/auth/guards";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";

export const dynamic = "force-dynamic";

export default async function AdminPermissionsPage() {
  await requireUserPermission("admin.access");
  const [permissions, roleDisplayLabels] = await Promise.all([getAdminPermissions(), getRoleDisplayNameOverrides()]);
  const groups = permissions.reduce<Record<string, typeof permissions>>((permissionGroups, permission) => {
    permissionGroups[permission.group] = [...(permissionGroups[permission.group] ?? []), permission];
    return permissionGroups;
  }, {});

  return (
    <AdminShell
      title="Permissions"
      description="Permission catalogue used by guards, admin navigation visibility, seed data, and future policy checks."
    >
      <div className="space-y-5">
        {Object.entries(groups).map(([group, permissions]) => (
          <section className="rounded-md border border-bc-line bg-bc-panel p-5" key={group}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-black">{group}</h3>
              <Badge tone="cyan">{permissions.length} grants</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {permissions.map((permission) => (
                <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={permission.key}>
                  <Badge tone="muted">{permission.key}</Badge>
                  <p className="mt-3 text-sm text-bc-muted">{permission.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {permission.roles.length ? (
                      permission.roles.map(({ role }) => (
                        <Badge key={role.id} tone={roleBadgeTone(role.name)}>
                          {roleDisplayName(role.name, roleDisplayLabels)}
                        </Badge>
                      ))
                    ) : (
                      <Badge tone="amber">No role grants</Badge>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
