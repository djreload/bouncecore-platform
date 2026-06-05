import { Activity, CheckCircle2, Gauge, Server, TriangleAlert, WifiOff, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { requireUserPermission } from "@/lib/auth/guards";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "healthy" || status === "connected" || status === "configured") {
    return "acid" as const;
  }

  if (status === "warning" || status === "unknown" || status === "waiting") {
    return "amber" as const;
  }

  return "pink" as const;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "healthy" || status === "connected" || status === "configured") {
    return <CheckCircle2 className="h-5 w-5 text-bc-acid" aria-hidden="true" />;
  }

  if (status === "critical" || status === "missing" || status === "disconnected") {
    return <XCircle className="h-5 w-5 text-bc-pink" aria-hidden="true" />;
  }

  return <TriangleAlert className="h-5 w-5 text-bc-amber" aria-hidden="true" />;
}

export default async function StreamerHealthPage() {
  await requireUserPermission("stream.dashboard");
  const liveState = await getPublicLiveState();
  const health = liveState.health;
  const checks = [
    {
      label: "Provider health",
      value: health.status,
      detail: `Last checked ${formatDate(health.checkedAt)}.`,
      icon: Activity
    },
    {
      label: "Ingest connection",
      value: health.ingestConnected ? "connected" : "disconnected",
      detail: health.ingestConnected ? "The provider reports an active ingest connection." : "No ingest connection is currently reported.",
      icon: Server
    },
    {
      label: "Playback URL",
      value: liveState.playbackUrl ? "configured" : "missing",
      detail: liveState.playbackUrl ?? "Set a playback URL in the stream channel or provider settings.",
      icon: Gauge
    },
    {
      label: "Bitrate",
      value: health.bitrateKbps ? `${health.bitrateKbps} kbps` : "waiting",
      detail: health.bitrateKbps ? "Provider bitrate telemetry is available." : "Bitrate telemetry is not available from the provider yet.",
      icon: Activity
    },
    {
      label: "Dropped frames",
      value: typeof health.droppedFrames === "number" ? health.droppedFrames.toString() : "waiting",
      detail:
        typeof health.droppedFrames === "number"
          ? "Provider dropped-frame telemetry is available."
          : "Dropped-frame telemetry is not available from the provider yet.",
      icon: WifiOff
    }
  ];

  return (
    <DashboardShell
      mode="streamer"
      title="Stream health"
      description="Provider health, ingest readiness, playback configuration, and telemetry checks for the current live setup."
    >
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={statusTone(health.status)}>{health.status.toUpperCase()}</Badge>
          <div className="mt-4 flex items-center gap-3">
            <StatusIcon status={health.status} />
            <p className="text-3xl font-black capitalize">{health.status}</p>
          </div>
          <p className="mt-2 text-sm text-bc-muted">Current stream-provider health.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={health.ingestConnected ? "acid" : "pink"}>Ingest</Badge>
          <p className="mt-4 text-3xl font-black">{health.ingestConnected ? "Connected" : "Offline"}</p>
          <p className="mt-2 text-sm text-bc-muted">Provider ingest connection state.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Checked</Badge>
          <p className="mt-4 text-lg font-black">{formatDate(health.checkedAt)}</p>
          <p className="mt-2 text-sm text-bc-muted">Latest health snapshot time.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Readiness checks</h3>
          <p className="mt-1 text-sm text-bc-muted">Operational checks from the stream provider and platform channel settings.</p>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {checks.map((check) => {
            const Icon = check.icon;

            return (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={check.label}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                    <h4 className="font-semibold">{check.label}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={check.value} />
                    <Badge tone={statusTone(check.value)}>{check.value}</Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm text-bc-muted">{check.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </DashboardShell>
  );
}
