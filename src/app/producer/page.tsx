import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";

export default function ProducerPage() {
  return (
    <DashboardShell
      mode="producer"
      title="Producer overview"
      description="Producer workspace for tracks, uploads, approvals, licenses, sales, downloads, and public profile management."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {["Tracks", "Approvals", "Sales"].map((item) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={item}>
            <Badge tone="acid">{item}</Badge>
            <h3 className="mt-4 text-xl font-black">{item}</h3>
            <p className="mt-2 text-sm text-bc-muted">Marketplace module placeholder.</p>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
