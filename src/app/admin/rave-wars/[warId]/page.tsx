import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Clock3, FileJson, Radio, ShieldCheck, Swords } from "lucide-react";
import { RaveWarRepairControls } from "@/app/admin/rave-wars/rave-war-repair-controls";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminRaveWarMatchDiagnostics } from "@/lib/rave-wars/rave-war-admin-service";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(date) : "Not recorded";
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

function statusTone(status: string): "acid" | "amber" | "cyan" | "muted" {
  if (status === "active") {
    return "acid";
  }

  if (status === "pending") {
    return "amber";
  }

  return status === "finished" ? "cyan" : "muted";
}

export default async function AdminRaveWarTimelinePage({ params }: { params: Promise<{ warId: string }> }) {
  await requireUserPermission("settings.manage");
  const { warId } = await params;
  const match = await getAdminRaveWarMatchDiagnostics(warId);

  if (!match) {
    notFound();
  }

  return (
    <AdminShell
      description="Review the ordered server event timeline, action identifiers, timing gaps, and stored payloads for one Rave War."
      requiredPermission="settings.manage"
      title="Rave War timeline"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ButtonLink href="/admin/rave-wars" variant="ghost">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to diagnostics
          </ButtonLink>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(match.status)}>{match.status.toUpperCase()}</Badge>
            <Badge tone={match.needsAttention ? "pink" : "acid"}>{match.needsAttention ? "Needs attention" : "Sequence clean"}</Badge>
          </div>
        </div>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-bc-electric" aria-hidden="true" />
                <Badge tone="cyan">{match.room.name}</Badge>
              </div>
              <h2 className="mt-4 text-2xl font-black">{match.participants.map((participant) => participant.displayNameSnapshot).join(" vs ")}</h2>
              <p className="mt-2 font-mono text-xs text-bc-muted">{match.id}</p>
              <p className="mt-1 text-sm text-bc-muted">#{match.room.slug} / {match.levelKey}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {match.participants.map((participant) => (
                <Badge key={participant.userId} tone={match.winnerUserId === participant.userId ? "acid" : "muted"}>
                  {participant.displayNameSnapshot}{match.winnerUserId === participant.userId ? " - winner" : ""}
                </Badge>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Clock3 className="h-5 w-5 text-bc-electric" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Started</p>
              <p className="mt-1 text-sm text-bc-muted">{formatDate(match.startedAt ?? match.createdAt)}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Radio className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Stored events</p>
              <p className="mt-1 text-sm text-bc-muted">{match.diagnostics.totalEventCount.toLocaleString("en-GB")} total / {match.events.length} shown</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Activity className="h-5 w-5 text-bc-amber" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Event timing</p>
              <p className="mt-1 text-sm text-bc-muted">Average {formatGap(match.diagnostics.averageEventGapMs)} / peak {formatGap(match.diagnostics.maxEventGapMs)}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <ShieldCheck className={`h-5 w-5 ${match.needsAttention ? "text-bc-pink" : "text-bc-acid"}`} aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">State integrity</p>
              <p className="mt-1 text-sm text-bc-muted">Revision {match.revision} / turn {match.turnNumber}</p>
            </article>
          </div>
        </section>

        <RaveWarRepairControls stalled={match.stalled} status={match.status} warId={match.id} />

        <section className="rounded-md border border-bc-line bg-bc-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
            <div>
              <h2 className="text-xl font-black">Server event timeline</h2>
              <p className="mt-1 text-sm text-bc-muted">Oldest to newest within the latest 1,000 stored events.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={match.diagnostics.sequenceGapCount > 0 ? "pink" : "acid"}>{match.diagnostics.sequenceGapCount} sequence gaps</Badge>
              <Badge tone={match.diagnostics.duplicateActionIdCount > 0 ? "pink" : "acid"}>{match.diagnostics.duplicateActionIdCount} duplicate actions</Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="text-bc-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sequence</th>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action ID</th>
                  <th className="px-4 py-3 font-semibold">Gap</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {match.events.map((event) => (
                  <tr className="border-t border-bc-line align-top" key={event.id}>
                    <td className="px-4 py-4 font-mono text-xs text-bc-muted">#{event.sequence}</td>
                    <td className="max-w-[360px] px-4 py-4">
                      <p className="font-semibold">{event.type}</p>
                      <details className="mt-2">
                        <summary className="bc-focus-ring cursor-pointer text-xs font-semibold text-bc-electric">View payload</summary>
                        <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-bc-line bg-black/50 p-3 text-xs leading-relaxed text-bc-muted">
                          {event.payloadPreview}
                        </pre>
                      </details>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">{event.actorDisplayName ?? "System"}</p>
                      {event.actorUserId ? <p className="mt-1 font-mono text-xs text-bc-muted">{event.actorUserId.slice(0, 12)}</p> : null}
                    </td>
                    <td className="max-w-[260px] break-all px-4 py-4 font-mono text-xs text-bc-muted">{event.actionId ?? "--"}</td>
                    <td className="px-4 py-4 text-bc-muted">{formatGap(event.gapMs)}</td>
                    <td className="px-4 py-4 text-bc-muted">{formatDate(event.createdAt)}</td>
                  </tr>
                ))}
                {!match.events.length ? (
                  <tr className="border-t border-bc-line">
                    <td className="px-4 py-10 text-center text-bc-muted" colSpan={6}>No server events were stored for this match.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h2 className="text-xl font-black">Match timestamps</h2>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-bc-muted sm:grid-cols-3">
            <p><span className="font-semibold text-white">Created:</span> {formatDate(match.createdAt)}</p>
            <p><span className="font-semibold text-white">Started:</span> {formatDate(match.startedAt)}</p>
            <p><span className="font-semibold text-white">Ended:</span> {formatDate(match.endedAt)}</p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
