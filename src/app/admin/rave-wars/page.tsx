import { Activity, Radio, Search, ShieldCheck, Swords } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminRaveWarDiagnosticsData } from "@/lib/rave-wars/rave-war-admin-service";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not recorded";
}

function formatGap(milliseconds: number | null) {
  if (milliseconds === null) {
    return "--";
  }

  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)}s`;
}

function statusTone(status: string): "acid" | "amber" | "cyan" | "muted" | "pink" {
  if (status === "active") {
    return "acid";
  }

  if (status === "pending") {
    return "amber";
  }

  if (status === "finished") {
    return "cyan";
  }

  return "muted";
}

export default async function AdminRaveWarsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireUserPermission("settings.manage");
  const filters = await searchParams;
  const query = filters.q?.trim() ?? "";
  const status = filters.status?.trim().toLowerCase() ?? "all";
  const data = await getAdminRaveWarDiagnosticsData({ query, status });

  return (
    <AdminShell
      description="Inspect recent match state, event timing, action integrity, and stalled active games without adding traffic to live matches."
      requiredPermission="settings.manage"
      title="Rave War diagnostics"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Recent matches</Badge>
          <p className="mt-4 text-3xl font-black">{data.summary.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Latest matches included in this operational window.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.summary.active > 0 ? "acid" : "muted"}>Active now</Badge>
          <p className="mt-4 text-3xl font-black">{data.summary.active}</p>
          <p className="mt-2 text-sm text-bc-muted">Wars currently accepting turns and live updates.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Finished</Badge>
          <p className="mt-4 text-3xl font-black">{data.summary.finished}</p>
          <p className="mt-2 text-sm text-bc-muted">Completed matches in the recent diagnostics window.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.summary.attention > 0 ? "pink" : "acid"}>Needs attention</Badge>
          <p className="mt-4 text-3xl font-black">{data.summary.attention}</p>
          <p className="mt-2 text-sm text-bc-muted">Stalled games, sequence gaps, or duplicate accepted actions.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h2 className="text-xl font-black">Recent match integrity</h2>
            <p className="mt-1 text-sm text-bc-muted">Timing is derived from the latest 250 stored server events per match.</p>
          </div>
          <Badge tone={data.summary.attention > 0 ? "pink" : "acid"}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {data.summary.attention > 0 ? `${data.summary.attention} flagged` : "All clear"}
          </Badge>
        </div>
        <form className="grid gap-3 border-b border-bc-line p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto_auto]" method="get">
          <label className="grid gap-1 text-xs font-semibold uppercase text-bc-muted">
            Search matches
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-normal normal-case text-white"
              defaultValue={query}
              name="q"
              placeholder="Player, room, level, or match ID"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-bc-muted">
            Match status
            <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-normal normal-case text-white" defaultValue={status} name="status">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="finished">Finished</option>
              <option value="cancelled">Cancelled</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <Button className="self-end" type="submit" variant="ghost"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
          <ButtonLink className="self-end" href="/admin/rave-wars" variant="ghost">Reset</ButtonLink>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1360px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Match</th>
                <th className="px-4 py-3 font-semibold">Players</th>
                <th className="px-4 py-3 font-semibold">Timeline</th>
                <th className="px-4 py-3 font-semibold">Entry accounting</th>
                <th className="px-4 py-3 font-semibold">Events</th>
                <th className="px-4 py-3 font-semibold">Server timing</th>
                <th className="px-4 py-3 font-semibold">Integrity</th>
              </tr>
            </thead>
            <tbody>
              {data.matches.map((match) => (
                <tr className="border-t border-bc-line align-top" key={match.id}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Swords className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                      <Badge tone={statusTone(match.status)}>{match.status.toUpperCase()}</Badge>
                    </div>
                    <p className="mt-2 font-semibold">{match.room.name}</p>
                    <p className="mt-1 text-xs text-bc-muted">#{match.room.slug}</p>
                    <p className="mt-1 font-mono text-xs text-bc-muted" title={match.id}>{match.id.slice(0, 12)}</p>
                    <p className="mt-1 text-xs text-bc-muted">{match.levelKey}</p>
                    <ButtonLink className="mt-3" href={`/admin/rave-wars/${encodeURIComponent(match.id)}`} size="sm" variant="ghost">
                      Open timeline
                    </ButtonLink>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      {match.participants.map((participant) => (
                        <div className="flex items-center gap-2" key={participant.userId}>
                          <Radio className={`h-3.5 w-3.5 ${match.winnerUserId === participant.userId ? "text-bc-acid" : "text-bc-muted"}`} aria-hidden="true" />
                          <span className="font-semibold">{participant.displayNameSnapshot}</span>
                          {match.winnerUserId === participant.userId ? <Badge tone="acid">Winner</Badge> : null}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-bc-muted">
                    <p><span className="font-semibold text-white">Created:</span> {formatDate(match.createdAt)}</p>
                    <p className="mt-1"><span className="font-semibold text-white">Started:</span> {formatDate(match.startedAt)}</p>
                    <p className="mt-1"><span className="font-semibold text-white">Ended:</span> {formatDate(match.endedAt)}</p>
                  </td>
                  <td className="px-4 py-4 text-xs text-bc-muted">
                    <p><span className="font-semibold text-white">Charged:</span> {match.entryStars.toLocaleString("en-GB")}</p>
                    <p className="mt-1"><span className="font-semibold text-white">Refund:</span> {match.entryStarsRefundedAt ? formatDate(match.entryStarsRefundedAt) : match.entryStars > 0 ? "Not refunded" : "Not applicable"}</p>
                    <p className="mt-1"><span className="font-semibold text-white">End reason:</span> {match.terminationReason ?? "Not recorded"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold">{match.diagnostics.totalEventCount.toLocaleString("en-GB")} total</p>
                    <p className="mt-1 text-xs text-bc-muted">
                      {match.diagnostics.inspectedEventCount.toLocaleString("en-GB")} inspected, {match.diagnostics.shotCount} shots, {match.diagnostics.moveCount} moves
                    </p>
                    <p className="mt-1 text-xs text-bc-muted">Revision {match.revision}, turn {match.turnNumber}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p><span className="font-semibold">Average gap:</span> {formatGap(match.diagnostics.averageEventGapMs)}</p>
                    <p className="mt-1"><span className="font-semibold">Maximum gap:</span> {formatGap(match.diagnostics.maxEventGapMs)}</p>
                    <p className="mt-1 text-xs text-bc-muted">Latest: {formatDate(match.diagnostics.latestEventAt)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={match.needsAttention ? "pink" : "acid"}>
                      <Activity className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      {match.needsAttention ? "Attention" : "Clean"}
                    </Badge>
                    <p className="mt-2 text-xs text-bc-muted">Sequence gaps: {match.diagnostics.sequenceGapCount}</p>
                    <p className="mt-1 text-xs text-bc-muted">Duplicate actions: {match.diagnostics.duplicateActionIdCount}</p>
                    <p className="mt-1 text-xs text-bc-muted">Tracked action IDs: {match.diagnostics.actionIdCount}</p>
                  </td>
                </tr>
              ))}
              {!data.matches.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-10 text-center text-bc-muted" colSpan={7}>No Rave War matches match these filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
