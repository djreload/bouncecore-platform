"use client";

import Image from "next/image";
import { useActionState } from "react";
import { EyeOff, Flag, Save, ShieldAlert } from "lucide-react";
import { adminReportsAction } from "@/app/admin/reports/actions";
import { initialAdminReportsActionState, type AdminReportsActionState } from "@/app/admin/reports/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminReportsData } from "@/lib/chat/moderation-service";

type AdminReportsPanelProps = {
  data: AdminReportsData;
};

const reportStatusOptions = ["open", "reviewing", "resolved", "dismissed"] as const;

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not set";
}

function statusTone(status: string) {
  if (status === "open") {
    return "pink" as const;
  }

  if (status === "reviewing") {
    return "amber" as const;
  }

  if (status === "resolved") {
    return "acid" as const;
  }

  return "muted" as const;
}

export function AdminReportsPanel({ data }: AdminReportsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminReportsActionState, FormData>(
    adminReportsAction,
    initialAdminReportsActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-5">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Total</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent report records.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Open</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.open}</p>
          <p className="mt-2 text-sm text-bc-muted">Awaiting review.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Reviewing</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.reviewing}</p>
          <p className="mt-2 text-sm text-bc-muted">Currently being handled.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Resolved</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.resolved}</p>
          <p className="mt-2 text-sm text-bc-muted">Action taken.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="muted">Dismissed</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.dismissed}</p>
          <p className="mt-2 text-sm text-bc-muted">No action required.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Moderation</Badge>
            <h3 className="mt-4 text-2xl font-black">Chat reports</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Reports keep message snapshots so moderation records survive normal 24-hour chat-history pruning.
            </p>
          </div>
          <ShieldAlert className="h-7 w-7 text-bc-pink" aria-hidden="true" />
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
      </section>

      <div className="grid gap-4">
        {data.reports.map((report) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={report.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(report.status)}>{report.status}</Badge>
                  <Badge tone="muted">{report.reason}</Badge>
                  {report.roomSlug ? <Badge tone="cyan">#{report.roomSlug}</Badge> : null}
                </div>
                <h3 className="mt-3 text-xl font-black">{report.targetDisplayName}</h3>
                <p className="mt-1 text-sm text-bc-muted">
                  Reported by {report.reporterDisplayName} / {formatDate(report.createdAt)}
                </p>
              </div>
              <Flag className="h-6 w-6 text-bc-pink" aria-hidden="true" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-md border border-bc-line bg-bc-ink p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-black">Reported message</h4>
                  <Badge tone={report.messageDeletedAt ? "muted" : "acid"}>
                    {report.messageDeletedAt ? "hidden" : "visible"}
                  </Badge>
                </div>
                {report.messageKind === "gif" && report.mediaPreviewUrl ? (
                  <Image
                    alt={report.messageBody ?? "Reported GIF"}
                    className="mt-3 h-auto max-h-40 w-auto rounded-md border border-bc-line object-contain"
                    height={160}
                    src={report.mediaPreviewUrl}
                    unoptimized
                    width={240}
                  />
                ) : null}
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white">
                  {report.messageBody ?? "No message snapshot available."}
                </p>
                {report.notes ? <p className="mt-3 text-sm text-bc-muted">Reporter note: {report.notes}</p> : null}
                <div className="mt-4 grid gap-2 text-xs text-bc-muted sm:grid-cols-2">
                  <p>Room: {report.roomName}</p>
                  <p>Reporter: {report.reporterEmail ?? "Snapshot only"}</p>
                  <p>Target: {report.targetEmail ?? "Guest or deleted user"}</p>
                  <p>Resolved: {report.resolvedByDisplayName ?? "Not resolved"}</p>
                </div>
              </div>

              <div className="rounded-md border border-bc-line bg-bc-ink p-4">
                <form action={formAction} className="grid gap-3">
                  <input name="intent" type="hidden" value="status" />
                  <input name="reportId" type="hidden" value={report.id} />
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`status-${report.id}`}>
                    Status
                  </label>
                  <select
                    className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={report.status}
                    disabled={pending}
                    id={`status-${report.id}`}
                    name="status"
                  >
                    {reportStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`resolution-${report.id}`}>
                    Resolution note
                  </label>
                  <textarea
                    className="min-h-24 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={report.resolutionNote ?? ""}
                    disabled={pending}
                    id={`resolution-${report.id}`}
                    name="resolutionNote"
                  />
                  <Button disabled={pending} type="submit" variant="primary">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save status
                  </Button>
                </form>

                <form action={formAction} className="mt-3">
                  <input name="intent" type="hidden" value="hide-message" />
                  <input name="reportId" type="hidden" value={report.id} />
                  <Button disabled={pending || !report.messageId || Boolean(report.messageDeletedAt)} type="submit" variant="pink">
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    Hide message
                  </Button>
                </form>
              </div>
            </div>
          </article>
        ))}

        {!data.reports.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <ShieldAlert className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">No reports yet</h3>
            <p className="mt-2 text-sm text-bc-muted">User-submitted chat reports will appear here.</p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
