"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { clearAuditLogsAction } from "@/app/admin/audit-logs/actions";
import {
  initialAdminAuditLogsActionState,
  type AdminAuditLogsActionState
} from "@/app/admin/audit-logs/state";
import { Button } from "@/components/ui/button";

type ClearAuditLogsFormProps = {
  confirmationText: string;
  disabled: boolean;
};

export function ClearAuditLogsForm({ confirmationText, disabled }: ClearAuditLogsFormProps) {
  const [state, formAction, pending] = useActionState<AdminAuditLogsActionState, FormData>(
    clearAuditLogsAction,
    initialAdminAuditLogsActionState
  );

  return (
    <div className="grid gap-2">
      <form action={formAction} className="flex flex-wrap gap-2">
        <input
          aria-label="Audit log clear confirmation"
          autoComplete="off"
          className="min-h-9 w-52 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-xs text-white"
          name="confirmation"
          placeholder={confirmationText}
          required
        />
        <Button disabled={disabled || pending} size="sm" type="submit" variant="pink">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {pending ? "Clearing..." : "Clear logs"}
        </Button>
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
