import { Search } from "lucide-react";
import { adminNavigation } from "@/config/navigation";
import { GroupedNav } from "@/components/navigation/grouped-nav";

type AdminShellProps = {
  children: React.ReactNode;
  title: string;
  description: string;
};

export function AdminShell({ children, title, description }: AdminShellProps) {
  return (
    <main className="min-h-screen bg-bc-void text-white">
      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-md border border-bc-line bg-bc-ink p-4">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase text-bc-pink">Bouncecore admin</p>
            <h1 className="mt-1 text-xl font-black">Control room</h1>
          </div>
          <div className="mb-5 flex items-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-bc-muted">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Search users, orders, streams</span>
          </div>
          <GroupedNav items={adminNavigation} />
        </aside>
        <section>
          <div className="mb-5 rounded-md border border-bc-line bg-bc-panel p-5">
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
