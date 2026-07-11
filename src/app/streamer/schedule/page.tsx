import { CalendarClock, Clock3, Radio, UserRound } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { requireUserPermission } from "@/lib/auth/guards";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getStreamerScheduleData, type PublicStreamScheduleRow } from "@/lib/stream/stream-schedule-service";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "live" || status === "completed") {
    return "acid" as const;
  }

  if (status === "scheduled") {
    return "cyan" as const;
  }

  return "pink" as const;
}

function ScheduleCard({
  roleDisplayLabels,
  schedule
}: {
  roleDisplayLabels: Record<string, string>;
  schedule: PublicStreamScheduleRow;
}) {
  return (
    <article className="rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(schedule.status)}>{schedule.status}</Badge>
            <Badge tone="muted">/{schedule.channelSlug}</Badge>
          </div>
          <h3 className="mt-4 text-xl font-black">{schedule.title}</h3>
          <p className="mt-2 text-sm text-bc-muted">
            {formatDate(schedule.startsAt)} to {formatDate(schedule.endsAt)}
          </p>
          {schedule.description ? <p className="mt-3 max-w-3xl text-sm text-bc-muted">{schedule.description}</p> : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-bc-muted">
          <Radio className="h-4 w-4 text-bc-electric" aria-hidden="true" />
          {schedule.channelTitle}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <UserRound className="h-4 w-4 text-bc-muted" aria-hidden="true" />
        <span className="text-sm text-bc-muted">{schedule.hostDisplayName ?? "No host assigned"}</span>
        {visibleRoleBadges(schedule.hostRoles).map((role) => (
          <Badge key={role} tone={roleBadgeTone(role)}>
            {roleDisplayName(role, roleDisplayLabels)}
          </Badge>
        ))}
      </div>
    </article>
  );
}

export default async function StreamerSchedulePage() {
  const user = await requireUserPermission("stream.dashboard");
  const [scheduleData, roleDisplayLabels] = await Promise.all([
    getStreamerScheduleData(user.id),
    getRoleDisplayNameOverrides()
  ]);

  return (
    <DashboardShell
      mode="streamer"
      title="My schedule"
      description="Assigned live slots, upcoming show times, and channel lineup details for your streamer account."
    >
      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Assigned</Badge>
          <p className="mt-4 text-3xl font-black">{scheduleData.stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Total slots assigned to you.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Upcoming</Badge>
          <p className="mt-4 text-3xl font-black">{scheduleData.stats.upcoming}</p>
          <p className="mt-2 text-sm text-bc-muted">Scheduled shows still ahead.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Live</Badge>
          <p className="mt-4 text-3xl font-black">{scheduleData.stats.live}</p>
          <p className="mt-2 text-sm text-bc-muted">Slots currently marked live.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Cancelled</Badge>
          <p className="mt-4 text-3xl font-black">{scheduleData.stats.cancelled}</p>
          <p className="mt-2 text-sm text-bc-muted">Assigned slots cancelled by admins.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-ink">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">Assigned lineup</h3>
            <p className="mt-1 text-sm text-bc-muted">Schedules created by admins appear here when you are the host.</p>
          </div>
          <CalendarClock className="h-6 w-6 text-bc-pink" aria-hidden="true" />
        </div>
        <div className="grid gap-4 p-4">
          {scheduleData.schedules.map((schedule) => (
            <ScheduleCard key={schedule.id} roleDisplayLabels={roleDisplayLabels} schedule={schedule} />
          ))}

          {!scheduleData.schedules.length ? (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Clock3 className="h-7 w-7 text-bc-electric" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No assigned shows yet</h3>
              <p className="mt-2 text-sm text-bc-muted">
                When an admin assigns you to a scheduled live slot, it will appear here automatically.
              </p>
            </article>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
