import { FileText, LayoutDashboard } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import {
  accountFeatureNavigation,
  accountNavigation,
  adminNavigation,
  producerNavigation,
  publicNavigation,
  streamerNavigation,
  type NavigationItem
} from "@/config/navigation";

const pageGroups: Array<{ description: string; label: string; pages: NavigationItem[]; tone: "cyan" | "pink" | "acid" | "amber" }> = [
  {
    description: "Visitor routes available from the public header.",
    label: "Public",
    pages: publicNavigation,
    tone: "cyan"
  },
  {
    description: "Signed-in account routes and assigned feature shortcuts.",
    label: "Account",
    pages: [...accountNavigation, ...accountFeatureNavigation],
    tone: "pink"
  },
  {
    description: "Streamer dashboard routes for DJs and stream owners.",
    label: "Streamer",
    pages: streamerNavigation,
    tone: "acid"
  },
  {
    description: "Producer workspace routes for music marketplace sellers.",
    label: "Producer",
    pages: producerNavigation,
    tone: "amber"
  },
  {
    description: "Admin control room modules grouped by operational area.",
    label: "Admin",
    pages: adminNavigation,
    tone: "cyan"
  }
];

export default async function AdminPagesPage() {
  const totalPages = pageGroups.reduce((total, group) => total + group.pages.length, 0);

  return (
    <AdminShell
      title="Pages"
      description="Review the current route registry used by public, account, workspace, and admin navigation."
      requiredPermission="site.manage"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Routes</Badge>
          <p className="mt-4 text-3xl font-black">{totalPages}</p>
          <p className="mt-2 text-sm text-bc-muted">Navigation-linked pages currently registered.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Areas</Badge>
          <p className="mt-4 text-3xl font-black">{pageGroups.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Public, account, streamer, producer, and admin.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Source</Badge>
          <p className="mt-4 text-3xl font-black">Config</p>
          <p className="mt-2 text-sm text-bc-muted">Rendered from `src/config/navigation.ts`.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="pink">Site map</Badge>
            <h3 className="mt-4 text-2xl font-black">Navigation-linked pages</h3>
          </div>
          <LayoutDashboard className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {pageGroups.map((group) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={group.label}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={group.tone}>{group.label}</Badge>
                  <p className="mt-3 text-sm text-bc-muted">{group.description}</p>
                </div>
                <span className="text-sm font-semibold text-bc-muted">{group.pages.length} routes</span>
              </div>
              <div className="mt-4 grid gap-2">
                {group.pages.map((page) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm"
                    key={`${group.label}-${page.href}`}
                  >
                    <span className="font-semibold">{page.label}</span>
                    <span className="break-all text-bc-muted">{page.href}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-bc-electric" aria-hidden="true" />
          <h3 className="text-xl font-black">Content management status</h3>
        </div>
        <p className="mt-3 text-sm text-bc-muted">
          Page publishing is currently code/config driven. This screen now gives admins a live registry of the routes exposed
          by navigation, and it is the right place to extend into database-backed page editing later.
        </p>
      </section>
    </AdminShell>
  );
}
