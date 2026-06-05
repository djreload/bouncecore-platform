import { Activity, CalendarClock, KeyRound, Radio, Signal } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";
import { getOwnActiveStreamKey } from "@/lib/stream/stream-key-service";
import { getStreamerScheduleData } from "@/lib/stream/stream-schedule-service";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "live" || status === "healthy") {
    return "acid" as const;
  }

  if (status === "starting" || status === "degraded" || status === "warning" || status === "unknown") {
    return "amber" as const;
  }

  return "muted" as const;
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Not yet";
}

export default async function StreamerPage() {
  const user = await requireUserPermission("stream.dashboard");
  const [liveState, streamKey, scheduleData] = await Promise.all([
    getPublicLiveState(),
    getOwnActiveStreamKey(user.id),
    getStreamerScheduleData(user.id)
  ]);
  const nextSchedule = scheduleData.schedules.find((schedule) => schedule.status === "live" || schedule.status === "scheduled");

  return (
    <DashboardShell
      mode="streamer"
      title="Streamer overview"
      description="DJ and streamer workspace for status, health, schedule, profile, OBS setup, and secure stream-key management."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <Badge tone={statusTone(liveState.status)}>{liveState.status.toUpperCase()}</Badge>
            <Radio className="h-5 w-5 text-bc-electric" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-xl font-black">Stream status</h3>
          <p className="mt-2 text-sm text-bc-muted">
            {liveState.channel?.title ?? "No channel configured"} with {liveState.viewerCount} provider viewers.
          </p>
          <ButtonLink className="mt-4" href="/streamer/status" size="sm" variant="ghost">
            <Signal className="h-4 w-4" aria-hidden="true" />
            View status
          </ButtonLink>
        </article>

        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <Badge tone={statusTone(liveState.health.status)}>{liveState.health.status.toUpperCase()}</Badge>
            <Activity className="h-5 w-5 text-bc-pink" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-xl font-black">Stream health</h3>
          <p className="mt-2 text-sm text-bc-muted">
            Ingest connected: {liveState.health.ingestConnected ? "yes" : "no"}. Checked {formatDate(liveState.health.checkedAt)}.
          </p>
          <ButtonLink className="mt-4" href="/streamer/health" size="sm" variant="ghost">
            <Activity className="h-4 w-4" aria-hidden="true" />
            View health
          </ButtonLink>
        </article>

        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <Badge tone={streamKey ? "acid" : "amber"}>{streamKey ? "KEY ACTIVE" : "KEY NEEDED"}</Badge>
            <KeyRound className="h-5 w-5 text-bc-acid" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-xl font-black">Stream key</h3>
          <p className="mt-2 text-sm text-bc-muted">
            {streamKey ? `Fingerprint ${streamKey.fingerprint}. Last used ${formatDate(streamKey.lastUsedAt)}.` : "Create a key before going live."}
          </p>
          <ButtonLink className="mt-4" href="/streamer/stream-key" size="sm" variant="ghost">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Manage key
          </ButtonLink>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Next set</Badge>
            <h3 className="mt-4 text-2xl font-black">{nextSchedule?.title ?? "No upcoming set assigned"}</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              {nextSchedule
                ? `${formatDate(nextSchedule.startsAt)} to ${formatDate(nextSchedule.endsAt)} on ${nextSchedule.channelTitle}.`
                : "Assigned schedule slots from the admin lineup will appear here."}
            </p>
          </div>
          <ButtonLink href="/streamer/schedule" variant="primary">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            View schedule
          </ButtonLink>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Badge tone="muted">Assigned</Badge>
            <p className="mt-3 text-2xl font-black">{scheduleData.stats.total}</p>
          </div>
          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Badge tone="cyan">Upcoming</Badge>
            <p className="mt-3 text-2xl font-black">{scheduleData.stats.upcoming}</p>
          </div>
          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Badge tone="acid">Live</Badge>
            <p className="mt-3 text-2xl font-black">{scheduleData.stats.live}</p>
          </div>
          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Badge tone="pink">Cancelled</Badge>
            <p className="mt-3 text-2xl font-black">{scheduleData.stats.cancelled}</p>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
