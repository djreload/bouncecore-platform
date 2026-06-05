import { Activity, CreditCard, KeyRound, Lock, MessageSquare, Music, ShoppingBag, ShieldCheck, Users } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { getAdminDashboardData } from "@/lib/admin/admin-data";
import { requireUserPermission } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireUserPermission("admin.access");
  const data = await getAdminDashboardData();
  const panels = [
    { label: "Users", value: data.users, icon: Users, tone: "cyan" as const },
    { label: "Roles", value: data.roles, icon: ShieldCheck, tone: "pink" as const },
    { label: "Permissions", value: data.permissions, icon: Lock, tone: "acid" as const },
    { label: "Active sessions", value: data.activeSessions, icon: Activity, tone: "amber" as const },
    { label: "Stream keys", value: data.streamKeys, icon: KeyRound, tone: "amber" as const },
    { label: "Chatrooms", value: data.chatrooms, icon: MessageSquare, tone: "pink" as const },
    { label: "Tracks", value: data.tracks, icon: Music, tone: "acid" as const },
    { label: "Products", value: data.products, icon: ShoppingBag, tone: "cyan" as const },
    { label: "Orders", value: data.orders, icon: CreditCard, tone: "amber" as const }
  ];

  return (
    <AdminShell
      title="Dashboard"
      description="Organised admin foundation for users, streaming, chat, marketplace, shop, payments, rewards, mobile, design, and settings."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {panels.map((panel) => {
          const Icon = panel.icon;
          return (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={panel.label}>
              <div className="flex items-center justify-between">
                <Badge tone={panel.tone}>{panel.label}</Badge>
                <Icon className="h-5 w-5 text-bc-muted" aria-hidden="true" />
              </div>
              <p className="mt-5 text-4xl font-black">{panel.value.toLocaleString("en-GB")}</p>
              <p className="mt-2 text-sm text-bc-muted">Live count from the Bouncecore database.</p>
            </article>
          );
        })}
      </div>
      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-bc-electric" aria-hidden="true" />
          <h3 className="text-xl font-black">System notes</h3>
        </div>
        <p className="mt-3 text-sm text-bc-muted">
          The staging domain is proxied through Plesk to the Bouncecore Docker app. Admin pages now require a valid
          Bouncecore session and the `admin.access` permission.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="acid">{data.auditLogs.toLocaleString("en-GB")} audit events</Badge>
          <Badge tone="cyan">RBAC seeded</Badge>
          <Badge tone="pink">Owner setup locked</Badge>
        </div>
      </section>
    </AdminShell>
  );
}
