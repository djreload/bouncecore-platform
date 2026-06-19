"use client";

import { useActionState } from "react";
import { Inbox, Mail, Save } from "lucide-react";
import { adminSupportAction } from "@/app/admin/support/actions";
import { initialAdminSupportActionState, type AdminSupportActionState } from "@/app/admin/support/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminSupportRequestsData } from "@/lib/support/support-service";
import { supportStatuses } from "@/lib/support/support-request-core";

type AdminSupportPanelProps = {
  data: AdminSupportRequestsData;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not set";
}

function toneForStatus(status: string) {
  if (status === "open") {
    return "pink" as const;
  }

  if (status === "reviewing" || status === "waiting") {
    return "amber" as const;
  }

  if (status === "resolved") {
    return "acid" as const;
  }

  return "muted" as const;
}

function toneForPriority(priority: string) {
  if (priority === "urgent") {
    return "pink" as const;
  }

  if (priority === "high") {
    return "amber" as const;
  }

  return "muted" as const;
}

function labelFromKey(value: string) {
  return value.replaceAll("-", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function AdminSupportPanel({ data }: AdminSupportPanelProps) {
  const [state, formAction, pending] = useActionState<AdminSupportActionState, FormData>(
    adminSupportAction,
    initialAdminSupportActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-6">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Total</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.total}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Open</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.open}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Reviewing</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.reviewing}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Waiting</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.waiting}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Resolved</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.resolved}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="muted">Dismissed</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.dismissed}</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Support</Badge>
            <h3 className="mt-4 text-2xl font-black">Request inbox</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Public support requests are stored here and written to the audit log when created or updated.
            </p>
          </div>
          <Inbox className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>

        {state.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              state.status === "error" ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink" : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4">
        {data.requests.map((request) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={request.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={toneForStatus(request.status)}>{labelFromKey(request.status)}</Badge>
                  <Badge tone={toneForPriority(request.priority)}>{labelFromKey(request.priority)}</Badge>
                  <Badge tone="cyan">{labelFromKey(request.category)}</Badge>
                </div>
                <h3 className="mt-3 text-xl font-black">{request.subject}</h3>
                <p className="mt-1 text-sm text-bc-muted">
                  {request.name ?? request.userDisplayName ?? "Visitor"} / {request.email} / {formatDate(request.createdAt)}
                </p>
              </div>
              <Mail className="h-6 w-6 text-bc-electric" aria-hidden="true" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-md border border-bc-line bg-bc-ink p-4">
                <h4 className="font-black">Message</h4>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white">{request.message}</p>
                <div className="mt-4 grid gap-2 text-xs text-bc-muted sm:grid-cols-2">
                  <p>Request ID: {request.id}</p>
                  <p>Linked user: {request.userEmail ?? "None"}</p>
                  <p>Resolved by: {request.resolvedByDisplayName ?? "Not resolved"}</p>
                  <p>Resolved at: {formatDate(request.resolvedAt)}</p>
                </div>
                {request.resolutionNote ? <p className="mt-3 text-sm text-bc-muted">Resolution: {request.resolutionNote}</p> : null}
              </div>

              <form action={formAction} className="rounded-md border border-bc-line bg-bc-ink p-4">
                <input name="requestId" type="hidden" value={request.id} />
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`support-status-${request.id}`}>
                  Status
                </label>
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={request.status}
                  disabled={pending}
                  id={`support-status-${request.id}`}
                  name="status"
                >
                  {supportStatuses.map((status) => (
                    <option key={status} value={status}>
                      {labelFromKey(status)}
                    </option>
                  ))}
                </select>
                <label className="mt-4 block text-xs font-semibold uppercase text-bc-muted" htmlFor={`support-note-${request.id}`}>
                  Resolution note
                </label>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={request.resolutionNote ?? ""}
                  disabled={pending}
                  id={`support-note-${request.id}`}
                  name="resolutionNote"
                />
                <Button className="mt-4" disabled={pending} type="submit" variant="primary">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save request
                </Button>
              </form>
            </div>
          </article>
        ))}

        {!data.requests.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Inbox className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">No support requests yet</h3>
            <p className="mt-2 text-sm text-bc-muted">Public support submissions will appear here.</p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
