import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";

export default function AccountPage() {
  return (
    <DashboardShell title="Overview" description="Unified account shell for profile, orders, downloads, rewards, notifications, security, and settings.">
      <div className="grid gap-4 md:grid-cols-3">
        {["Orders", "Downloads", "Rewards"].map((item) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={item}>
            <Badge tone="cyan">{item}</Badge>
            <h3 className="mt-4 text-xl font-black">{item}</h3>
            <p className="mt-2 text-sm text-bc-muted">Placeholder for account module data.</p>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
