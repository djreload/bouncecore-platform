import { Clock, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { AdminUserInvitesPanel } from "@/app/admin/users/invites-panel";
import {
  AddUserRoleForm,
  DeleteUserForm,
  PasswordResetForm,
  RemoveUserRoleForm,
  UserStatusForm
} from "@/app/admin/users/user-management-forms";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { getAdminRoles, getAdminUsers } from "@/lib/admin/admin-data";
import { requireUserPermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { userStatusOptions } from "@/lib/auth/user-admin-service";
import { getAdminUserInvites, inviteAssignableRoles } from "@/lib/auth/user-invite-service";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(date)
    : "Not yet";
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
  const actor = await requireUserPermission("admin.access");
  const [users, roles, roleDisplayLabels, invites] = await Promise.all([
    getAdminUsers(),
    getAdminRoles(),
    getRoleDisplayNameOverrides(),
    getAdminUserInvites()
  ]);
  const activeUsers = users.filter((user) => user.status === "active").length;
  const ownerUsers = users.filter((user) => user.roles.some((userRole) => userRole.role.name === "owner")).length;
  const canDeleteUsers = hasPermission(actor, "users.manage");

  return (
    <AdminShell
      title="Users"
      description="Manage account status, roles, invites, account security, and audit-friendly admin actions."
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

      <AdminUserInvitesPanel invites={invites} roleDisplayLabels={roleDisplayLabels} roles={inviteAssignableRoles} />

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">User directory</h3>
            <p className="mt-1 text-sm text-bc-muted">Database-backed directory with roles, status, sessions, and stream-key counts.</p>
          </div>
          <Badge tone="cyan">{users.length} accounts</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Roles</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Sessions</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
                <th className="px-4 py-3 font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const assignedRoleNames = new Set(user.roles.map((userRole) => userRole.role.name));
                const assignableRoles = roles.filter((role) => !assignedRoleNames.has(role.name));
                const isLastOwner = assignedRoleNames.has("owner") && ownerUsers <= 1;
                const visibleUserRoles = user.roles.filter((userRole) => visibleRoleBadges([userRole.role.name]).length);
                const statusChoices = userStatusOptions.filter((status) => {
                  if ((user.id === actor.id || isLastOwner) && (status === "suspended" || status === "banned")) {
                    return false;
                  }

                  return true;
                });

                return (
                  <tr className="border-t border-bc-line align-top" key={user.email}>
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
                      <div className="grid gap-2">
                          {visibleUserRoles.length ? (
                            visibleUserRoles.map((userRole) => (
                            <div className="flex flex-wrap items-center gap-2" key={userRole.roleId}>
                              <Badge tone={roleBadgeTone(userRole.role.name)}>
                                {roleDisplayName(userRole.role.name, roleDisplayLabels)}
                              </Badge>
                              {userRole.role.name === "owner" && isLastOwner ? (
                                <Badge tone="amber">Required</Badge>
                              ) : <RemoveUserRoleForm role={userRole.role.name} userId={user.id} />}
                            </div>
                          ))
                        ) : (
                          <Badge tone="muted">No roles</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                      <UserStatusForm statuses={statusChoices} userId={user.id} value={user.status} />
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
                    <td className="px-4 py-3">
                      <div className="grid gap-3">
                        {assignableRoles.length ? (
                          <AddUserRoleForm
                            roles={assignableRoles.map((role) => ({
                              id: role.id,
                              label: `${roleDisplayName(role.name, roleDisplayLabels)} (${role.name})`,
                              value: role.name
                            }))}
                            userId={user.id}
                          />
                        ) : (
                          <Badge tone="muted">All roles assigned</Badge>
                        )}

                        {canDeleteUsers ? <PasswordResetForm email={user.email} userId={user.id} /> : null}

                        {canDeleteUsers ? (
                          user.id === actor.id ? (
                            <Badge tone="muted">Delete from account settings</Badge>
                          ) : isLastOwner ? (
                            <Badge tone="amber">Last owner cannot be deleted</Badge>
                          ) : (
                            <DeleteUserForm email={user.email} userId={user.id} />
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!users.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={7}>
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
