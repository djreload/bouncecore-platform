import { GroupedNav } from "@/components/navigation/grouped-nav";
import { accountNavigation, producerNavigation, streamerNavigation } from "@/config/navigation";

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description: string;
  mode?: "account" | "streamer" | "producer";
};

export function DashboardShell({ children, title, description, mode = "account" }: DashboardShellProps) {
  const roleItems = mode === "streamer" ? streamerNavigation : mode === "producer" ? producerNavigation : [];

  return (
    <main className="min-h-screen bg-bc-void text-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[290px_1fr]">
        <aside className="rounded-md border border-bc-line bg-bc-ink p-4">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase text-bc-electric">Bouncecore account</p>
            <h1 className="mt-1 text-xl font-black">{mode === "account" ? "Dashboard" : title}</h1>
          </div>
          <GroupedNav items={[...accountNavigation, ...roleItems]} />
        </aside>
        <section>
          <div className="mb-5 rounded-md border border-bc-line bg-bc-panel p-5">
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
