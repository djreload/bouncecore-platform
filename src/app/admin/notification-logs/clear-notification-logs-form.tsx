"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { clearNotificationLogsAction } from "@/app/admin/notification-logs/actions";
import {
  initialAdminNotificationLogsActionState,
  type AdminNotificationLogsActionState
} from "@/app/admin/notification-logs/state";
import { Button } from "@/components/ui/button";

type ClearNotificationLogsFormProps = {
  confirmationText: string;
  disabled: boolean;
};

export function ClearNotificationLogsForm({ confirmationText, disabled }: ClearNotificationLogsFormProps) {
  const [state, formAction, pending] = useActionState<AdminNotificationLogsActionState, FormData>(
    clearNotificationLogsAction,
    initialAdminNotificationLogsActionState
  );

  return (
    <div className="grid gap-2">
      <form action={formAction} className="flex flex-wrap gap-2">
        <input
          aria-label="Notification log clear confirmation"
          autoComplete="off"
          className="min-h-10 w-64 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          name="confirmation"
          placeholder={confirmationText}
          required
        />
        <Button disabled={disabled || pending} type="submit" variant="pink">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {pending ? "Clearing..." : "Clear notification logs"}
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
