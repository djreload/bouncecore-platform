import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";

export default function StreamerPage() {
  return (
    <DashboardShell
      mode="streamer"
      title="Streamer overview"
      description="DJ and streamer workspace for status, health, schedule, profile, OBS setup, and secure stream-key management."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {["Offline", "No ingest", "Schedule empty"].map((item) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={item}>
            <Badge tone="muted">{item}</Badge>
            <h3 className="mt-4 text-xl font-black">Stream panel</h3>
            <p className="mt-2 text-sm text-bc-muted">Mock data until the stream provider and database are wired.</p>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
