import { Bell, Download, Package, ShieldCheck, Star, UserRound } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getAccountOverviewData } from "@/lib/account/account-service";

export const dynamic = "force-dynamic";

const overviewLinks = [
  {
    body: "Shop order history and fulfilment status.",
    href: "/account/orders",
    icon: Package,
    label: "Orders"
  },
  {
    body: "Owned music downloads and licenses.",
    href: "/account/downloads",
    icon: Download,
    label: "Downloads"
  },
  {
    body: "Buy stars and review PayPal star purchase history.",
    href: "/account/rewards",
    icon: Star,
    label: "Stars"
  },
  {
    body: "Sessions, access, and account protection.",
    href: "/account/security",
    icon: ShieldCheck,
    label: "Security"
  }
];

export default async function AccountPage() {
  const user = await requireSignedInUser();
  const data = await getAccountOverviewData(user.id);

  return (
    <DashboardShell title="Overview" description="Account summary across profile, purchases, stars, notifications, and security.">
      <div className="grid gap-4 md:grid-cols-5">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Orders</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.orders}</p>
          <p className="mt-2 text-sm text-bc-muted">Shop orders.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Music</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.musicPurchases}</p>
          <p className="mt-2 text-sm text-bc-muted">Owned tracks.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Stars</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.rewardsBalance}</p>
          <p className="mt-2 text-sm text-bc-muted">Wallet balance.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Unread</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.notificationsUnread}</p>
          <p className="mt-2 text-sm text-bc-muted">Notifications.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="muted">Sessions</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.sessions}</p>
          <p className="mt-2 text-sm text-bc-muted">Active sessions.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone={data.profileIsPublic ? "acid" : "muted"}>{data.profileIsPublic ? "Public profile" : "Private profile"}</Badge>
            <h3 className="mt-4 text-2xl font-black">{data.displayName}</h3>
            <p className="mt-2 text-sm text-bc-muted">{data.email}</p>
            <p className="mt-1 text-xs text-bc-muted">Profile slug: {data.profileSlug}</p>
          </div>
          <UserRound className="h-7 w-7 text-bc-electric" aria-hidden="true" />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/account/profile" variant="primary">
            Edit profile
          </ButtonLink>
          <ButtonLink href="/account/notifications" variant="ghost">
            <Bell className="h-4 w-4" aria-hidden="true" />
            Notifications
          </ButtonLink>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        {overviewLinks.map((item) => {
          const Icon = item.icon;

          return (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={item.href}>
              <Icon className="h-6 w-6 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">{item.label}</h3>
              <p className="mt-2 text-sm text-bc-muted">{item.body}</p>
              <div className="mt-4">
                <ButtonLink href={item.href} variant="ghost">
                  Open {item.label.toLowerCase()}
                </ButtonLink>
              </div>
            </article>
          );
        })}
      </section>
    </DashboardShell>
  );
}
