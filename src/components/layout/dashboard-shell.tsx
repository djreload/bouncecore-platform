import { Home } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { GroupedNav } from "@/components/navigation/grouped-nav";
import { ButtonLink } from "@/components/ui/button";
import { accountFeatureNavigation, accountNavigation, producerNavigation, streamerNavigation } from "@/config/navigation";
import { filterNavigationByRoles, type Role } from "@/lib/auth/rbac";
import { requireAnyRole, requireSignedInUser } from "@/lib/auth/guards";
import { getSiteThemeStyle } from "@/lib/admin/site-design-service";

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description: string;
  mode?: "account" | "streamer" | "producer";
};

const workspaceRoles = {
  account: null,
  streamer: ["streamer", "admin", "owner"],
  producer: ["producer", "admin", "owner"]
} satisfies Record<NonNullable<DashboardShellProps["mode"]>, readonly Role[] | null>;

export async function DashboardShell({ children, title, description, mode = "account" }: DashboardShellProps) {
  const [user, themeStyle] = await Promise.all([
    workspaceRoles[mode] ? requireAnyRole(workspaceRoles[mode]) : requireSignedInUser(),
    getSiteThemeStyle()
  ]);
  const roleItems = mode === "streamer" ? streamerNavigation : mode === "producer" ? producerNavigation : [];
  const accountFeatureItems = mode === "account" ? accountFeatureNavigation : [];
  const visibleNavigation = filterNavigationByRoles([...accountNavigation, ...accountFeatureItems, ...roleItems], user.roles);

  return (
    <main className="bc-dashboard-shell min-h-screen bg-bc-void text-white" style={themeStyle}>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[290px_1fr]">
        <aside className="bc-dashboard-sidebar rounded-md border border-bc-line bg-bc-ink p-4">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase text-bc-electric">Bouncecore account</p>
            <h1 className="mt-1 text-xl font-black">{mode === "account" ? "Dashboard" : title}</h1>
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
        <section>
          <div className="bc-dashboard-hero mb-5 rounded-md border border-bc-line bg-bc-panel p-5">
            <p className="text-sm text-bc-muted">Account / {title}</p>
            <h2 className="mt-1 text-3xl font-black">{title}</h2>
            <p className="mt-2 max-w-3xl text-bc-muted">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
