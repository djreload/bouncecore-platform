import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AccountSecurityPage() {
  const [user, roleDisplayLabels] = await Promise.all([getCurrentUser(), getRoleDisplayNameOverrides()]);

  return (
    <DashboardShell
      title="Security"
      description="Account security, session state, password controls, and role visibility for Bouncecore-owned authentication."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <div>
              <Badge tone={user ? "acid" : "muted"}>{user ? "Signed in" : "Signed out"}</Badge>
              <h3 className="mt-3 text-2xl font-black">Session status</h3>
            </div>
          </div>
          {user ? (
            <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
              <div className="rounded-md border border-bc-line bg-bc-ink p-4">
                <dt className="font-semibold">Display name</dt>
                <dd className="mt-1 text-bc-muted">{user.displayName}</dd>
              </div>
              <div className="rounded-md border border-bc-line bg-bc-ink p-4">
                <dt className="font-semibold">Email</dt>
                <dd className="mt-1 text-bc-muted">{user.email}</dd>
              </div>
              <div className="rounded-md border border-bc-line bg-bc-ink p-4 md:col-span-2">
                <dt className="font-semibold">Roles</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {user.roles.length ? (
                    user.roles.map((role) => (
                      <Badge key={role} tone={roleBadgeTone(role)}>
                        {roleDisplayName(role, roleDisplayLabels)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="muted">No role grants yet</Badge>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-5 text-sm text-bc-muted">
              No valid Bouncecore session cookie was found. Login and registration now post to server routes, but they
              need the dedicated Bouncecore database and seeded roles before they can persist accounts.
            </p>
          )}
          {user ? (
            <form action="/api/auth/logout" className="mt-5" method="post">
              <Button type="submit" variant="pink">
                Sign out
              </Button>
            </form>
          ) : null}
        </section>

        <aside className="space-y-4">
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Lock className="h-7 w-7 text-bc-pink" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">Password security</h3>
            <p className="mt-2 text-sm text-bc-muted">
              Passwords are hashed with `scrypt`; reset tokens are designed to be stored as hashes.
            </p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <KeyRound className="h-7 w-7 text-bc-acid" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">Session cookies</h3>
            <p className="mt-2 text-sm text-bc-muted">
              Session tokens use HTTP-only cookies and database-stored token hashes.
            </p>
          </article>
        </aside>
      </div>
    </DashboardShell>
  );
}
