import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { groupPermissionsByArea } from "@/lib/auth/rbac";

export default function AdminPermissionsPage() {
  const groups = groupPermissionsByArea();

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
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
