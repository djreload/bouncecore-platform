import { Activity, Radio, Sparkles } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requireUserPermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";
import { getAdminStreamSessionsData } from "@/lib/stream/stream-channel-service";
import { SyncProviderButton } from "@/app/admin/stream-sessions/sync-provider-button";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function eventPayload(payload: unknown) {
  if (!payload) {
    return "None";
  }

  return JSON.stringify(payload);
}

export default async function AdminStreamSessionsPage() {
  const actor = await requireUserPermission("stream.dashboard");
  const { sessions, events } = await getAdminStreamSessionsData();
  const openSessions = sessions.filter((session) => !session.endedAt).length;
  const totalSessionStars = sessions.reduce((total, session) => total + session.starsSent, 0);
  const canSyncProvider = hasPermission(actor, "stream.settings.manage");

  return (
    <AdminShell
      title="Stream sessions"
      description="Session history and channel events from the Bouncecore streaming boundary."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Sessions</Badge>
          <p className="mt-4 text-3xl font-black">{sessions.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent stream sessions stored in the platform database.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={openSessions ? "acid" : "muted"}>Open</Badge>
          <p className="mt-4 text-3xl font-black">{openSessions}</p>
          <p className="mt-2 text-sm text-bc-muted">Sessions currently marked live/open.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Stars</Badge>
          <p className="mt-4 text-3xl font-black">{totalSessionStars.toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-bc-muted">Stars linked to recent stream sessions.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Events</Badge>
          <p className="mt-4 text-3xl font-black">{events.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent status and provider events.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Provider sync</Badge>
            <h3 className="mt-4 text-2xl font-black">Refresh stream state</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Pull the latest stream provider snapshot into Bouncecore sessions, events, public live state, and stream health views.
            </p>
          </div>
          <SyncProviderButton canSync={canSyncProvider} />
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Recent sessions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold">Started</th>
                <th className="px-4 py-3 font-semibold">Ended</th>
                <th className="px-4 py-3 font-semibold">Peak viewers</th>
                <th className="px-4 py-3 font-semibold">Stars</th>
                <th className="px-4 py-3 font-semibold">Sends</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr className="border-t border-bc-line" key={session.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                      <span className="font-semibold">{session.channel.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">{formatDate(session.startedAt)}</td>
                  <td className="px-4 py-3 text-bc-muted">{session.endedAt ? formatDate(session.endedAt) : "Live/open"}</td>
                  <td className="px-4 py-3 text-bc-muted">{session.peakViewers}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-bc-muted">
                      <Sparkles className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                      <span>{session.starsSent.toLocaleString("en-GB")}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">{session.starSendCount.toLocaleString("en-GB")}</td>
                </tr>
              ))}
              {!sessions.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={6}>
                    No stream sessions have been recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Recent events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold">Payload</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr className="border-t border-bc-line" key={event.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                      <span className="font-semibold">{event.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">{event.channel.title}</td>
                  <td className="max-w-[360px] truncate px-4 py-3 font-mono text-xs text-bc-muted">{eventPayload(event.payload)}</td>
                  <td className="px-4 py-3 text-bc-muted">{formatDate(event.createdAt)}</td>
                </tr>
              ))}
              {!events.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={4}>
                    No stream events have been recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
