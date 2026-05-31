import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { roleDefinitions, rolePermissions } from "@/lib/auth/rbac";

export default function AdminRolesPage() {
  return (
    <AdminShell
      title="Roles"
      description="System role map for Bouncecore account, admin, streaming, marketplace, commerce, and supporter access."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {roleDefinitions.map((role) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={role.key}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={role.key === "owner" ? "pink" : role.key === "streamer" ? "cyan" : "muted"}>{role.label}</Badge>
              <span className="text-xs font-semibold uppercase text-bc-muted">{rolePermissions[role.key].length} permissions</span>
            </div>
            <h3 className="mt-4 text-xl font-black">{role.label}</h3>
            <p className="mt-2 text-sm text-bc-muted">{role.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {rolePermissions[role.key].length ? (
                rolePermissions[role.key].map((permission) => (
                  <Badge key={permission} tone="muted">
                    {permission}
                  </Badge>
                ))
              ) : (
                <Badge tone="muted">Public/account defaults</Badge>
              )}
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
