import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requireUserPermission } from "@/lib/auth/guards";

export default async function AdminPlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  await requireUserPermission("admin.access");
  const { slug } = await params;
  const title = slug.map((part) => part.replaceAll("-", " ")).join(" / ");

  return (
    <AdminShell title={title} description="Admin module placeholder inside the organised Bouncecore control room.">
      <article className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone="muted">Planned</Badge>
        <h3 className="mt-4 text-xl font-black">{title}</h3>
        <p className="mt-2 text-sm text-bc-muted">This route is reserved for a database-backed admin module.</p>
      </article>
    </AdminShell>
  );
}
