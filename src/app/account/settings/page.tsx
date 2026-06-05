import { Bell, Lock, Settings, UserRound } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getAccountSettingsData } from "@/lib/account/account-service";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) {
    return "Not verified";
  }

  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AccountSettingsPage() {
  const user = await requireSignedInUser();
  const [data, roleDisplayLabels] = await Promise.all([getAccountSettingsData(user.id), getRoleDisplayNameOverrides()]);

  return (
    <DashboardShell title="Settings" description="Account state, profile visibility, roles, notifications, and security links.">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.status === "active" ? "acid" : "amber"}>Status</Badge>
          <p className="mt-4 text-3xl font-black capitalize">{data.status}</p>
          <p className="mt-2 text-sm text-bc-muted">Account access state.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.profileIsPublic ? "acid" : "muted"}>Profile</Badge>
          <p className="mt-4 text-3xl font-black">{data.profileIsPublic ? "Public" : "Hidden"}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.profileSlug}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Sessions</Badge>
          <p className="mt-4 text-3xl font-black">{data.activeSessions}</p>
          <p className="mt-2 text-sm text-bc-muted">Active browser sessions.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Unread</Badge>
          <p className="mt-4 text-3xl font-black">{data.unreadNotifications}</p>
          <p className="mt-2 text-sm text-bc-muted">Notifications.</p>
        </article>
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h3 className="text-xl font-black">Identity</h3>
          </div>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
              <span className="text-bc-muted">Display name</span>
              <span className="font-semibold">{data.displayName}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
              <span className="text-bc-muted">Email</span>
              <span className="font-semibold">{data.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
              <span className="text-bc-muted">Email verified</span>
              <span className="font-semibold">{formatDate(data.emailVerifiedAt)}</span>
            </div>
          </div>
          <div className="mt-4">
            <ButtonLink href="/account/profile" variant="primary">
              Edit profile
            </ButtonLink>
          </div>
        </article>

        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <h3 className="text-xl font-black">Roles</h3>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.roles.map((role) => (
              <Badge key={role} tone={roleBadgeTone(role)}>
                {roleDisplayName(role, roleDisplayLabels)}
              </Badge>
            ))}
          </div>
          <p className="mt-4 text-sm text-bc-muted">
            Role changes are managed by server owners and stream owners from the admin user directory.
          </p>
        </article>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Lock className="h-6 w-6 text-bc-pink" aria-hidden="true" />
          <h3 className="mt-4 text-xl font-black">Security settings</h3>
          <p className="mt-2 text-sm text-bc-muted">Review active sessions and revoke browsers you do not recognize.</p>
          <div className="mt-4">
            <ButtonLink href="/account/security" variant="ghost">
              Open security
            </ButtonLink>
          </div>
        </article>

        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Bell className="h-6 w-6 text-bc-acid" aria-hidden="true" />
          <h3 className="mt-4 text-xl font-black">Notification settings</h3>
          <p className="mt-2 text-sm text-bc-muted">Review account notifications and mark updates as handled.</p>
          <div className="mt-4">
            <ButtonLink href="/account/notifications" variant="ghost">
              Open notifications
            </ButtonLink>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
