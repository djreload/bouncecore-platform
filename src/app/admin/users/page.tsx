import { Mail, ShieldCheck, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleDefinitions } from "@/lib/auth/rbac";

const plannedUsers = [
  { name: "Platform owner", email: "owner@bouncecore.local", status: "Seed required", roles: ["Owner"] },
  { name: "Admin operator", email: "admin@bouncecore.local", status: "Seed required", roles: ["Admin"] },
  { name: "DJ/Streamer", email: "streamer@bouncecore.local", status: "Invite flow", roles: ["DJ/Streamer"] }
];

export default function AdminUsersPage() {
  return (
    <AdminShell
      title="Users"
      description="Phase 1 user-management foundation for status, roles, account security, and audit-friendly admin actions."
    >
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Roles</Badge>
          <p className="mt-4 text-3xl font-black">{roleDefinitions.length}</p>
          <p className="mt-2 text-sm text-bc-muted">System roles defined in code and seedable to the database.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Status</Badge>
          <p className="mt-4 text-3xl font-black">4</p>
          <p className="mt-2 text-sm text-bc-muted">Pending, active, suspended, and banned user states.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Audit</Badge>
          <p className="mt-4 text-3xl font-black">On</p>
          <p className="mt-2 text-sm text-bc-muted">User and role actions are planned for audit-log writes.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">User directory scaffold</h3>
            <p className="mt-1 text-sm text-bc-muted">Database-backed listing lands after the first migration is applied.</p>
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
              </tr>
            </thead>
            <tbody>
              {plannedUsers.map((user) => (
                <tr className="border-t border-bc-line" key={user.email}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                      <span className="font-semibold">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {user.roles.map((role) => (
                        <Badge key={role} tone="muted">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">{user.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
