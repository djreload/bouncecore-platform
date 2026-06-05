import { ListTree, Navigation } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import {
  accountFeatureNavigation,
  accountNavigation,
  adminNavigation,
  groupNavigation,
  producerNavigation,
  publicNavigation,
  streamerNavigation,
  type NavigationItem
} from "@/config/navigation";

const menus: Array<{ description: string; items: NavigationItem[]; label: string; tone: "cyan" | "pink" | "acid" | "amber" }> = [
  {
    description: "Header navigation shown on public pages.",
    items: publicNavigation,
    label: "Public header",
    tone: "cyan"
  },
  {
    description: "Signed-in account sidebar, including assigned feature shortcuts.",
    items: [...accountNavigation, ...accountFeatureNavigation],
    label: "Account menu",
    tone: "pink"
  },
  {
    description: "Streamer workspace navigation.",
    items: streamerNavigation,
    label: "Streamer menu",
    tone: "acid"
  },
  {
    description: "Producer workspace navigation.",
    items: producerNavigation,
    label: "Producer menu",
    tone: "amber"
  },
  {
    description: "Admin control room sidebar groups.",
    items: adminNavigation,
    label: "Admin menu",
    tone: "cyan"
  }
];

function itemAccessLabel(item: NavigationItem) {
  if (item.requiredPermission) {
    return item.requiredPermission;
  }

  if (item.requiredRoles?.length) {
    return item.requiredRoles.join(", ");
  }

  return "public";
}

export default async function AdminMenusPage() {
  const totalItems = menus.reduce((total, menu) => total + menu.items.length, 0);
  const groupedAdminItems = Object.keys(groupNavigation(adminNavigation)).length;

  return (
    <AdminShell
      title="Menus"
      description="Inspect the active navigation menus, grouping, access rules, and linked destinations."
      requiredPermission="site.manage"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Items</Badge>
          <p className="mt-4 text-3xl font-black">{totalItems}</p>
          <p className="mt-2 text-sm text-bc-muted">Total configured navigation items.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Menus</Badge>
          <p className="mt-4 text-3xl font-black">{menus.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Public, account, streamer, producer, and admin.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Admin groups</Badge>
          <p className="mt-4 text-3xl font-black">{groupedAdminItems}</p>
          <p className="mt-2 text-sm text-bc-muted">Sidebar groups in the admin control room.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="pink">Navigation</Badge>
            <h3 className="mt-4 text-2xl font-black">Configured menus</h3>
          </div>
          <Navigation className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {menus.map((menu) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={menu.label}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={menu.tone}>{menu.label}</Badge>
                  <p className="mt-3 text-sm text-bc-muted">{menu.description}</p>
                </div>
                <span className="text-sm font-semibold text-bc-muted">{menu.items.length} items</span>
              </div>
              <div className="mt-4 grid gap-2">
                {menu.items.map((item) => (
                  <div className="rounded-md border border-bc-line bg-bc-panel p-3 text-sm" key={`${menu.label}-${item.href}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-semibold">{item.label}</span>
                      <span className="break-all text-bc-muted">{item.href}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="muted">{item.group ?? "Main"}</Badge>
                      <Badge tone="cyan">{item.icon}</Badge>
                      <Badge tone="amber">{itemAccessLabel(item)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex items-center gap-3">
          <ListTree className="h-6 w-6 text-bc-electric" aria-hidden="true" />
          <h3 className="text-xl font-black">Menu management status</h3>
        </div>
        <p className="mt-3 text-sm text-bc-muted">
          Menus are currently controlled by the shared navigation config so access rules stay consistent across public,
          account, workspace, and admin shells.
        </p>
      </section>
    </AdminShell>
  );
}
