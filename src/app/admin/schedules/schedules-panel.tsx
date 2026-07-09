"use client";

import { useActionState, useSyncExternalStore } from "react";
import { CalendarClock, Clock3, Plus, Save, UserRound, XCircle } from "lucide-react";
import { adminScheduleAction } from "@/app/admin/schedules/actions";
import {
  adminScheduleStatusOptions,
  initialAdminScheduleActionState,
  type AdminScheduleActionState,
  type AdminScheduleChannelOption,
  type AdminScheduleHostOption,
  type AdminScheduleRow,
  type AdminScheduleStats
} from "@/app/admin/schedules/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges, type RoleDisplayNameMap } from "@/lib/auth/role-display";

type AdminSchedulesPanelProps = {
  channels: AdminScheduleChannelOption[];
  hosts: AdminScheduleHostOption[];
  roleDisplayLabels: RoleDisplayNameMap;
  schedules: AdminScheduleRow[];
  stats: AdminScheduleStats;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function dateTimeLocalValue(value: string, timezoneOffsetMinutes: number) {
  const date = new Date(value);

  return new Date(date.getTime() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 16);
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

function TimezoneOffsetInput({ timezoneOffsetMinutes }: { timezoneOffsetMinutes: number }) {
  return <input name="timezoneOffsetMinutes" type="hidden" value={timezoneOffsetMinutes} />;
}

function subscribeTimezoneOffset(callback: () => void) {
  const timeoutId = window.setTimeout(callback, 0);

  return () => window.clearTimeout(timeoutId);
}

function getTimezoneOffsetSnapshot() {
  return new Date().getTimezoneOffset();
}

function getServerTimezoneOffsetSnapshot() {
  return 0;
}

function HostOptions({ hosts }: { hosts: AdminScheduleHostOption[] }) {
  return (
    <>
      <option value="">No assigned host</option>
      {hosts.map((host) => (
        <option key={host.id} value={host.id}>
          {host.displayName} ({host.email})
        </option>
      ))}
    </>
  );
}

function ChannelOptions({ channels }: { channels: AdminScheduleChannelOption[] }) {
  return (
    <>
      <option value="">Choose channel</option>
      {channels.map((channel) => (
        <option key={channel.id} value={channel.id}>
          {channel.title} (/{channel.slug})
        </option>
      ))}
    </>
  );
}

export function AdminSchedulesPanel({ channels, hosts, roleDisplayLabels, schedules, stats }: AdminSchedulesPanelProps) {
  const [state, formAction, pending] = useActionState<AdminScheduleActionState, FormData>(
    adminScheduleAction,
    initialAdminScheduleActionState
  );
  const timezoneOffsetMinutes = useSyncExternalStore(
    subscribeTimezoneOffset,
    getTimezoneOffsetSnapshot,
    getServerTimezoneOffsetSnapshot
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Schedules</Badge>
          <p className="mt-4 text-3xl font-black">{stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent and upcoming stream schedule records.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Upcoming</Badge>
          <p className="mt-4 text-3xl font-black">{stats.upcoming}</p>
          <p className="mt-2 text-sm text-bc-muted">Scheduled sessions that have not started.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Live</Badge>
          <p className="mt-4 text-3xl font-black">{stats.live}</p>
          <p className="mt-2 text-sm text-bc-muted">Sessions currently marked live.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Cancelled</Badge>
          <p className="mt-4 text-3xl font-black">{stats.cancelled}</p>
          <p className="mt-2 text-sm text-bc-muted">Sessions removed from the active lineup.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Lineup</Badge>
            <h3 className="mt-4 text-2xl font-black">Create stream schedule</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Add a scheduled live slot for a channel, assign an optional host, and track the session state.
            </p>
          </div>
          <CalendarClock className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>

        {state.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <form action={formAction} className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <input name="intent" type="hidden" value="create" />
          <TimezoneOffsetInput timezoneOffsetMinutes={timezoneOffsetMinutes} />
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="create-channel">
              Channel
            </label>
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending || !channels.length}
              id="create-channel"
              name="channelId"
              required
            >
              <ChannelOptions channels={channels} />
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="create-host">
              Host
            </label>
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending}
              id="create-host"
              name="hostUserId"
            >
              <HostOptions hosts={hosts} />
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="create-starts">
              Starts
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending}
              id="create-starts"
              name="startsAt"
              required
              type="datetime-local"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="create-ends">
              Ends
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending}
              id="create-ends"
              name="endsAt"
              required
              type="datetime-local"
            />
          </div>
          <div className="flex items-end">
            <Button disabled={pending || !channels.length} type="submit" variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create
            </Button>
          </div>
          <div className="xl:col-span-2">
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="create-title">
              Title
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending}
              id="create-title"
              maxLength={120}
              name="title"
              placeholder="Saturday night takeover"
              required
            />
          </div>
          <div className="xl:col-span-2">
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="create-description">
              Description
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending}
              id="create-description"
              name="description"
              placeholder="Optional public schedule note"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="create-status">
              Status
            </label>
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue="scheduled"
              disabled={pending}
              id="create-status"
              name="status"
            >
              {adminScheduleStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">Schedule directory</h3>
            <p className="mt-1 text-sm text-bc-muted">Edit channel slots, host assignments, timing, and schedule status.</p>
          </div>
          <Badge tone="acid">{schedules.length} shown</Badge>
        </div>

        <div className="grid gap-4 p-4">
          {schedules.map((schedule) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={schedule.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(schedule.status)}>{schedule.status}</Badge>
                    <Badge tone="muted">/{schedule.channelSlug}</Badge>
                  </div>
                  <h4 className="mt-3 text-lg font-black">{schedule.title}</h4>
                  <p className="mt-1 text-sm text-bc-muted">
                    {formatDate(schedule.startsAt)} to {formatDate(schedule.endsAt)}
                  </p>
                  {schedule.description ? <p className="mt-2 max-w-3xl text-sm text-bc-muted">{schedule.description}</p> : null}
                </div>
                <div className="flex items-center gap-2 text-sm text-bc-muted">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  {schedule.hostDisplayName ?? "No host assigned"}
                </div>
              </div>

                {visibleRoleBadges(schedule.hostRoles).length ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {visibleRoleBadges(schedule.hostRoles).map((role) => (
                    <Badge key={role} tone={roleBadgeTone(role)}>
                      {roleDisplayName(role, roleDisplayLabels)}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <form action={formAction} className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <input name="intent" type="hidden" value="update" />
                <input name="scheduleId" type="hidden" value={schedule.id} />
                <TimezoneOffsetInput timezoneOffsetMinutes={timezoneOffsetMinutes} />
                <div>
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`channel-${schedule.id}`}>
                    Channel
                  </label>
                  <select
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={schedule.channelId}
                    disabled={pending}
                    id={`channel-${schedule.id}`}
                    name="channelId"
                    required
                  >
                    <ChannelOptions channels={channels} />
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`host-${schedule.id}`}>
                    Host
                  </label>
                  <select
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={schedule.hostUserId ?? ""}
                    disabled={pending}
                    id={`host-${schedule.id}`}
                    name="hostUserId"
                  >
                    <HostOptions hosts={hosts} />
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`starts-${schedule.id}`}>
                    Starts
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={dateTimeLocalValue(schedule.startsAt, timezoneOffsetMinutes)}
                    disabled={pending}
                    id={`starts-${schedule.id}`}
                    key={`starts-${schedule.id}-${timezoneOffsetMinutes}`}
                    name="startsAt"
                    required
                    type="datetime-local"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`ends-${schedule.id}`}>
                    Ends
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={dateTimeLocalValue(schedule.endsAt, timezoneOffsetMinutes)}
                    disabled={pending}
                    id={`ends-${schedule.id}`}
                    key={`ends-${schedule.id}-${timezoneOffsetMinutes}`}
                    name="endsAt"
                    required
                    type="datetime-local"
                  />
                </div>
                <div className="flex items-end">
                  <Button disabled={pending} type="submit" variant="dark">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save
                  </Button>
                </div>
                <div className="xl:col-span-2">
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`title-${schedule.id}`}>
                    Title
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={schedule.title}
                    disabled={pending}
                    id={`title-${schedule.id}`}
                    maxLength={120}
                    name="title"
                    required
                  />
                </div>
                <div className="xl:col-span-2">
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`description-${schedule.id}`}>
                    Description
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={schedule.description ?? ""}
                    disabled={pending}
                    id={`description-${schedule.id}`}
                    name="description"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`status-${schedule.id}`}>
                    Status
                  </label>
                  <select
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={schedule.status}
                    disabled={pending}
                    id={`status-${schedule.id}`}
                    name="status"
                  >
                    {adminScheduleStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </form>

              <form action={formAction} className="mt-3 flex justify-end">
                <input name="intent" type="hidden" value="cancel" />
                <input name="scheduleId" type="hidden" value={schedule.id} />
                <Button disabled={pending || schedule.status === "cancelled"} size="sm" type="submit" variant="pink">
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </Button>
              </form>
            </article>
          ))}

          {!schedules.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Clock3 className="h-7 w-7 text-bc-electric" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No scheduled streams yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Create the first slot once a stream channel exists.</p>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
