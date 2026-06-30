"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { cleanOrphanUploadsAction } from "@/app/admin/storage/actions";
import { initialAdminStorageActionState, type AdminStorageActionState } from "@/app/admin/storage/state";
import { orphanUploadBackupAcknowledgementText } from "@/lib/admin/maintenance-core";
import { Button } from "@/components/ui/button";

type CleanOrphanUploadsFormProps = {
  confirmationText: string;
  disabled: boolean;
};

export function CleanOrphanUploadsForm({ confirmationText, disabled }: CleanOrphanUploadsFormProps) {
  const [state, formAction, pending] = useActionState<AdminStorageActionState, FormData>(
    cleanOrphanUploadsAction,
    initialAdminStorageActionState
  );

  return (
    <div className="grid gap-2">
      <form action={formAction} className="grid gap-3">
        <label className="flex max-w-xl items-start gap-2 rounded-md border border-bc-line bg-bc-ink p-3 text-xs text-bc-muted">
          <input
            className="mt-0.5 h-4 w-4 accent-bc-electric"
            name="backupAcknowledged"
            required
            type="checkbox"
          />
          <span>{orphanUploadBackupAcknowledgementText}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Orphan upload cleanup confirmation"
            autoComplete="off"
            className="min-h-10 w-64 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="confirmation"
            placeholder={confirmationText}
            required
          />
          <Button disabled={disabled || pending} type="submit" variant="pink">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {pending ? "Cleaning..." : "Clean orphan uploads"}
          </Button>
        </div>
      </form>
      <p className="text-xs text-bc-muted">
        Type <span className="font-semibold text-white">{confirmationText}</span> exactly to confirm.
      </p>
      {state.message ? (
        <p className={`text-xs ${state.status === "error" ? "text-bc-pink" : "text-bc-acid"}`}>{state.message}</p>
      ) : null}
    </div>
  );
}
