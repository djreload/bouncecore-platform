import { Home } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { adminNavigation } from "@/config/navigation";
import { GroupedNav } from "@/components/navigation/grouped-nav";
import { ButtonLink } from "@/components/ui/button";
import { filterNavigationByRoles } from "@/lib/auth/rbac";
import type { Permission } from "@/lib/auth/rbac";
import { requireUserPermission } from "@/lib/auth/guards";
import { getSiteThemeStyle } from "@/lib/admin/site-design-service";

type AdminShellProps = {
  children: React.ReactNode;
  title: string;
  description: string;
  requiredPermission?: Permission;
};

export async function AdminShell({ children, title, description, requiredPermission = "admin.access" }: AdminShellProps) {
  const [user, themeStyle] = await Promise.all([requireUserPermission(requiredPermission), getSiteThemeStyle()]);
  const visibleNavigation = filterNavigationByRoles(adminNavigation, user.roles);

  return (
    <main
      className="bc-dashboard-shell min-h-screen bg-bc-void text-white"
      data-bc-visual-shell="admin"
      data-bc-visual-part="dashboard-shell"
      style={themeStyle}
    >
      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="bc-dashboard-sidebar rounded-md border border-bc-line bg-bc-ink p-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto" data-bc-visual-part="dashboard-sidebar">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase text-bc-pink">Bouncecore admin</p>
            <h1 className="mt-1 text-xl font-black">Control room</h1>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <ButtonLink className="w-full" href="/" size="sm" variant="ghost">
              <Home className="h-4 w-4" aria-hidden="true" />
              Home
            </ButtonLink>
            <LogoutButton />
          </div>
          <GroupedNav items={visibleNavigation} />
        </aside>
        <section className="min-w-0">
          <div className="bc-dashboard-hero mb-5 rounded-md border border-bc-line bg-bc-panel p-5" data-bc-visual-part="dashboard-hero">
            <p className="text-sm text-bc-muted">Admin / {title}</p>
            <h2 className="mt-1 text-3xl font-black">{title}</h2>
            <p className="mt-2 max-w-3xl text-bc-muted">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
