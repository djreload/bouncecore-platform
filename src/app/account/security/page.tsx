import { KeyRound, Laptop, Lock, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { revokeAccountSessionAction, revokeOtherAccountSessionsAction } from "@/app/account/security/actions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getCurrentUser, getSessionTokenHash } from "@/lib/auth/session";
import { getActiveAccountSessions } from "@/lib/auth/session-management";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function sessionLabel(userAgent: string | null) {
  if (!userAgent) {
    return "Unknown browser";
  }

  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";

  const platform = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Mac OS X")
      ? "macOS"
      : userAgent.includes("Android")
        ? "Android"
        : userAgent.includes("iPhone") || userAgent.includes("iPad")
          ? "iOS"
          : userAgent.includes("Linux")
            ? "Linux"
            : "device";

  return `${browser} on ${platform}`;
}

export default async function AccountSecurityPage() {
  const [user, roleDisplayLabels, currentTokenHash] = await Promise.all([
    getCurrentUser(),
    getRoleDisplayNameOverrides(),
    getSessionTokenHash()
  ]);
  const sessions = user ? await getActiveAccountSessions(user.id, currentTokenHash) : [];
  const otherSessionCount = sessions.filter((session) => !session.isCurrent).length;

  return (
    <DashboardShell
      title="Security"
      description="Account security, session state, password controls, and role visibility for Bouncecore-owned authentication."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
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
                      {visibleRoleBadges(user.roles).length ? (
                        visibleRoleBadges(user.roles).map((role) => (
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
          </section>

          {user ? (
            <section className="rounded-md border border-bc-line bg-bc-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
                <div className="flex items-center gap-3">
                  <Laptop className="h-6 w-6 text-bc-electric" aria-hidden="true" />
                  <div>
                    <h3 className="text-xl font-black">Active sessions</h3>
                    <p className="mt-1 text-sm text-bc-muted">{sessions.length} browser sessions can currently access this account.</p>
                  </div>
                </div>
                <form action={revokeOtherAccountSessionsAction}>
                  <Button disabled={!otherSessionCount} type="submit" variant="ghost">
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out others
                  </Button>
                </form>
              </div>

              <div className="grid gap-3 p-4">
                {sessions.map((session) => (
                  <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={session.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{sessionLabel(session.userAgent)}</p>
                          {session.isCurrent ? <Badge tone="acid">Current</Badge> : <Badge tone="cyan">Active</Badge>}
                        </div>
                        <p className="mt-2 text-sm text-bc-muted">{session.ipAddress ?? "No IP captured"}</p>
                        <p className="mt-1 break-all text-xs text-bc-muted">{session.userAgent ?? "No user agent captured"}</p>
                      </div>
                      {session.isCurrent ? (
                        <form action="/api/auth/logout" method="post">
                          <Button type="submit" variant="pink">
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            Sign out
                          </Button>
                        </form>
                      ) : (
                        <form action={revokeAccountSessionAction}>
                          <input name="sessionId" type="hidden" value={session.id} />
                          <Button type="submit" variant="dark">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Revoke
                          </Button>
                        </form>
                      )}
                    </div>
                    <dl className="mt-4 grid gap-3 text-xs text-bc-muted sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-white">Created</dt>
                        <dd className="mt-1">{formatDate(session.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-white">Expires</dt>
                        <dd className="mt-1">{formatDate(session.expiresAt)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
                {!sessions.length ? <p className="text-sm text-bc-muted">No active sessions are stored for this account.</p> : null}
              </div>
            </section>
          ) : null}
        </div>

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
