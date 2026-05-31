import { Activity, CreditCard, KeyRound, MessageSquare, Music, ShoppingBag, Users } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";

const panels = [
  { label: "Users", value: "0", icon: Users, tone: "cyan" as const },
  { label: "Stream keys", value: "0", icon: KeyRound, tone: "amber" as const },
  { label: "Chatrooms", value: "0", icon: MessageSquare, tone: "pink" as const },
  { label: "Tracks", value: "0", icon: Music, tone: "acid" as const },
  { label: "Products", value: "0", icon: ShoppingBag, tone: "cyan" as const },
  { label: "Payments", value: "0", icon: CreditCard, tone: "amber" as const }
];

export default function AdminPage() {
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
              <p className="mt-5 text-4xl font-black">{panel.value}</p>
              <p className="mt-2 text-sm text-bc-muted">Awaiting database-backed data.</p>
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
          The VPS currently appears to be managed by Plesk with nginx, Apache, MariaDB, PHP, and Docker. Deployment
          should be added through a Plesk-safe reverse proxy plan after confirming the domain subscription.
        </p>
      </section>
    </AdminShell>
  );
}
