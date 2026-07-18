import { Bell, Gauge, Lock, Settings, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getAccountSettingsData } from "@/lib/account/account-service";

export const dynamic = "force-dynamic";

const settingAreas = [
  {
    body: "Change your display name, avatar, biography, social links, and public profile visibility.",
    href: "/account/profile",
    icon: UserRound,
    label: "Profile"
  },
  {
    body: "Choose which account, purchase, live, mention, and challenge updates reach email or mobile push.",
    href: "/account/preferences",
    icon: Bell,
    label: "Notification delivery"
  },
  {
    body: "Review active browser sessions and revoke devices you no longer recognise.",
    href: "/account/security",
    icon: Lock,
    label: "Security"
  },
  {
    body: "See resource use and control video quality, background playback, animations, GIFs, vibration, and app ads.",
    href: "/account/performance",
    icon: Gauge,
    label: "Performance"
  },
  {
    body: "Manage consent, open policies, submit privacy requests, or permanently delete your account.",
    href: "/account/privacy",
    icon: ShieldCheck,
    label: "Privacy and data"
  },
  {
    body: "Read account alerts, open their related pages, mark them read, or clear the inbox.",
    href: "/account/notifications",
    icon: Bell,
    label: "Notification inbox"
  }
] satisfies Array<{ body: string; href: string; icon: LucideIcon; label: string }>;

export default async function AccountSettingsPage() {
  const user = await requireSignedInUser();
  const [data, roleDisplayLabels] = await Promise.all([getAccountSettingsData(user.id), getRoleDisplayNameOverrides()]);

  return (
    <DashboardShell title="Settings" description="Choose one account area to review or edit. Each page contains only its related controls.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-4">
          <Badge tone={data.status === "active" ? "acid" : "amber"}>Account</Badge>
          <p className="mt-3 text-2xl font-black capitalize">{data.status}</p>
          <p className="mt-1 text-xs text-bc-muted">Current access state</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-4">
          <Badge tone={data.profileIsPublic ? "acid" : "muted"}>Profile</Badge>
          <p className="mt-3 text-2xl font-black">{data.profileIsPublic ? "Public" : "Hidden"}</p>
          <p className="mt-1 truncate text-xs text-bc-muted">{data.profileSlug}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-4">
          <Badge tone="cyan">Sessions</Badge>
          <p className="mt-3 text-2xl font-black">{data.activeSessions}</p>
          <p className="mt-1 text-xs text-bc-muted">Signed-in browsers</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-4">
          <Badge tone="pink">Unread</Badge>
          <p className="mt-3 text-2xl font-black">{data.unreadNotifications}</p>
          <p className="mt-1 text-xs text-bc-muted">Inbox notifications</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Signed in as</Badge>
            <h3 className="mt-3 text-xl font-black">{data.displayName}</h3>
            <p className="mt-1 text-sm text-bc-muted">{data.email}</p>
          </div>
          <div className="flex max-w-xl flex-wrap justify-end gap-2">
            {visibleRoleBadges(data.roles).map((role) => (
              <Badge key={role} tone={roleBadgeTone(role)}>
                {roleDisplayName(role, roleDisplayLabels)}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-bc-electric" aria-hidden="true" />
          <h3 className="text-xl font-black">Account areas</h3>
        </div>
        <p className="mt-2 text-sm text-bc-muted">Open the area you need. Changes are saved from that page.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {settingAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={area.href}>
                <Icon className="h-6 w-6 text-bc-acid" aria-hidden="true" />
                <h4 className="mt-3 text-lg font-black">{area.label}</h4>
                <p className="mt-2 text-sm leading-6 text-bc-muted">{area.body}</p>
                <ButtonLink className="mt-4" href={area.href} size="sm" variant="ghost">
                  Open {area.label.toLowerCase()}
                </ButtonLink>
              </article>
            );
          })}
        </div>
      </section>
    </DashboardShell>
  );
}
