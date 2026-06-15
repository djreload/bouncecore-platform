import { KeyRound, Link2, Radio, Signal, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { obsServerUrlFromIngestUrl } from "@/lib/stream/ingest-url";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";
import { getOwnActiveStreamKey } from "@/lib/stream/stream-key-service";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "live") {
    return "acid" as const;
  }

  if (status === "starting" || status === "degraded") {
    return "amber" as const;
  }

  return "muted" as const;
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Not yet";
}

export default async function StreamerStatusPage() {
  const user = await requireUserPermission("stream.dashboard");
  const [liveState, streamKey] = await Promise.all([getPublicLiveState(), getOwnActiveStreamKey(user.id)]);
  const ingestUrl = process.env.RTMP_INGEST_URL ?? "rtmp://develop.k-nrg.co.uk/live";
  const obsServerUrl = obsServerUrlFromIngestUrl(ingestUrl);

  return (
    <DashboardShell
      mode="streamer"
      title="Stream status"
      description="Current channel state, provider status, playback readiness, and stream-key visibility for your live setup."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={statusTone(liveState.status)}>{liveState.status.toUpperCase()}</Badge>
          <p className="mt-4 text-3xl font-black">{liveState.channel?.title ?? "No channel"}</p>
          <p className="mt-2 text-sm text-bc-muted">Current public channel state.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={statusTone(liveState.provider.status)}>Provider</Badge>
          <p className="mt-4 text-3xl font-black capitalize">{liveState.provider.status}</p>
          <p className="mt-2 text-sm text-bc-muted">Stream-provider boundary status.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Viewers</Badge>
          <p className="mt-4 text-3xl font-black">{liveState.viewerCount}</p>
          <p className="mt-2 text-sm text-bc-muted">Provider-reported viewer count.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={streamKey ? "acid" : "amber"}>{streamKey ? "Key active" : "Key needed"}</Badge>
          <p className="mt-4 text-3xl font-black">{streamKey ? "Ready" : "Setup"}</p>
          <p className="mt-2 text-sm text-bc-muted">Private ingest key state.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">Live setup details</h3>
            <p className="mt-1 text-sm text-bc-muted">Use these values to confirm the stream route without exposing raw keys.</p>
          </div>
          <Signal className="h-6 w-6 text-bc-electric" aria-hidden="true" />
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-bc-electric" aria-hidden="true" />
              <h4 className="font-semibold">Channel</h4>
            </div>
            <p className="mt-3 text-sm text-bc-muted">
              {liveState.channel ? `${liveState.channel.title} /${liveState.channel.slug}` : "No stream channel exists yet."}
            </p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-bc-electric" aria-hidden="true" />
              <h4 className="font-semibold">Playback URL</h4>
            </div>
            <p className="mt-3 break-all text-sm text-bc-muted">{liveState.playbackUrl ?? "Playback URL is not configured."}</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <Signal className="h-4 w-4 text-bc-electric" aria-hidden="true" />
              <h4 className="font-semibold">OBS server URL</h4>
            </div>
            <p className="mt-3 break-all text-sm text-bc-muted">{obsServerUrl}</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-bc-electric" aria-hidden="true" />
              <h4 className="font-semibold">Stream key</h4>
            </div>
            <p className="mt-3 text-sm text-bc-muted">
              {streamKey ? `Fingerprint ${streamKey.fingerprint}. Last used ${formatDate(streamKey.lastUsedAt)}.` : "No active stream key."}
            </p>
            <ButtonLink className="mt-4" href="/streamer/stream-key" size="sm" variant="ghost">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Manage key
            </ButtonLink>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4 lg:col-span-2">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-bc-electric" aria-hidden="true" />
              <h4 className="font-semibold">Provider snapshot</h4>
            </div>
            <p className="mt-3 text-sm text-bc-muted">
              Status {liveState.provider.status}, {liveState.provider.viewerCount} viewers, health {liveState.provider.health.status}.
            </p>
          </article>
        </div>
      </section>
    </DashboardShell>
  );
}
