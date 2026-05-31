import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";

export default async function ProducerPlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const title = slug.map((part) => part.replaceAll("-", " ")).join(" / ");

  return (
    <DashboardShell mode="producer" title={title} description="Producer module placeholder inside the unified account shell.">
      <article className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone="muted">Planned</Badge>
        <h3 className="mt-4 text-xl font-black">{title}</h3>
        <p className="mt-2 text-sm text-bc-muted">This route is reserved for Phase 6 marketplace implementation.</p>
      </article>
    </DashboardShell>
  );
}
