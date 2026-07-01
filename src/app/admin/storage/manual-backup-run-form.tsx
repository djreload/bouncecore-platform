"use client";

import { useActionState } from "react";
import { DatabaseBackup } from "lucide-react";
import { queueManualBackupRunAction } from "@/app/admin/storage/actions";
import { initialAdminStorageActionState, type AdminStorageActionState } from "@/app/admin/storage/state";
import { Button } from "@/components/ui/button";
import type { AdminBackupRunData } from "@/lib/admin/backup-run-requests";

type ManualBackupRunFormProps = {
  data: AdminBackupRunData;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(
    new Date(value)
  );
}

function statusLabel(status: AdminBackupRunData["status"]["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "unknown":
      return "Unknown";
    default:
      return "No request";
  }
}

export function ManualBackupRunForm({ data }: ManualBackupRunFormProps) {
  const [state, formAction, pending] = useActionState<AdminStorageActionState, FormData>(
    queueManualBackupRunAction,
    initialAdminStorageActionState
  );
  const disabled = pending || !data.canRequest;
  const statusTone =
    data.status.status === "completed"
      ? "text-bc-acid"
      : data.status.status === "failed"
        ? "text-bc-pink"
        : data.status.status === "queued" || data.status.status === "running"
          ? "text-bc-amber"
          : "text-bc-muted";

  return (
    <section className="rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseBackup className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h3 className="text-xl font-black">Manual verified backup</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-bc-muted">
            Queue a one-off backup from the admin panel. The web app writes a request into the uploads volume; the host
            backup request timer runs the existing verified backup script and writes the result back here.
          </p>
        </div>

        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <Button disabled={disabled} type="submit" variant="primary">
            <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
            {pending ? "Queuing..." : "Run backup now"}
          </Button>
          {state.message ? (
            <p className={`max-w-sm text-xs ${state.status === "error" ? "text-bc-pink" : "text-bc-acid"}`}>{state.message}</p>
          ) : null}
        </form>
      </div>

      <div className="mt-4 grid gap-3 rounded-md border border-bc-line bg-bc-ink p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs uppercase text-bc-muted">Last manual status</p>
          <p className={`mt-1 font-black ${statusTone}`}>{statusLabel(data.status.status)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-bc-muted">Requested</p>
          <p className="mt-1 text-white">{formatDate(data.status.requestedAt ?? data.request?.requestedAt ?? null)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-bc-muted">Started</p>
          <p className="mt-1 text-white">{formatDate(data.status.startedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-bc-muted">Completed</p>
          <p className="mt-1 text-white">{formatDate(data.status.completedAt)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-bc-muted">{data.status.message}</p>
      {data.status.backupDir ? <p className="mt-2 break-all text-xs text-bc-muted">Backup: {data.status.backupDir}</p> : null}
      {data.status.logFile ? <p className="mt-2 break-all text-xs text-bc-muted">Log: {data.status.logFile}</p> : null}
      <p className="mt-3 break-all text-xs text-bc-muted">
        Request file: {data.requestVolumePath}. Status file: {data.statusVolumePath}.
      </p>
    </section>
  );
}
