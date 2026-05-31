import { Clock, KeyRound, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminUsers } from "@/lib/admin/admin-data";
import { requireUserPermission } from "@/lib/auth/guards";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not yet";
}

function statusTone(status: string) {
  if (status === "active") {
    return "acid" as const;
  }

  if (status === "pending") {
    return "amber" as const;
  }

  return "pink" as const;
}

export default async function AdminUsersPage() {
  await requireUserPermission("admin.access");
  const [users, roleDisplayLabels] = await Promise.all([getAdminUsers(), getRoleDisplayNameOverrides()]);
  const activeUsers = users.filter((user) => user.status === "active").length;
  const ownerUsers = users.filter((user) => user.roles.some((userRole) => userRole.role.name === "owner")).length;

  return (
    <AdminShell
      title="Users"
      description="Phase 1 user-management foundation for status, roles, account security, and audit-friendly admin actions."
    >
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Users</Badge>
          <p className="mt-4 text-3xl font-black">{users.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Accounts currently stored in the Bouncecore database.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Active</Badge>
          <p className="mt-4 text-3xl font-black">{activeUsers}</p>
          <p className="mt-2 text-sm text-bc-muted">Users allowed to authenticate right now.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Audit</Badge>
          <p className="mt-4 text-3xl font-black">{ownerUsers}</p>
          <p className="mt-2 text-sm text-bc-muted">Server owner assignments controlling full platform access.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">User directory scaffold</h3>
            <p className="mt-1 text-sm text-bc-muted">Database-backed directory with roles, status, sessions, and stream-key counts.</p>
          </div>
          <Button type="button" variant="ghost">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Invite user
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Roles</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Sessions</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-t border-bc-line" key={user.email}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                      <span className="font-semibold">{user.displayName}</span>
                    </div>
                    <p className="mt-1 text-xs text-bc-muted">{user.profile?.slug ? `/${user.profile.slug}` : "No profile slug"}</p>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {user.roles.length ? (
                        user.roles.map((userRole) => (
                          <Badge key={userRole.roleId} tone={roleBadgeTone(userRole.role.name)}>
                            {roleDisplayName(userRole.role.name, roleDisplayLabels)}
                          </Badge>
                        ))
                      ) : (
                        <Badge tone="muted">No roles</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      {user._count.authSessions} sessions / {user._count.streamKeys} keys
                    </div>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {formatDate(user.lastLoginAt)}
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={6}>
                    No users exist yet. Run owner setup to create the first account.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
