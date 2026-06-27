"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { clearNotificationsAction } from "@/app/account/notifications/actions";
import {
  initialAccountNotificationsActionState,
  type AccountNotificationsActionState
} from "@/app/account/notifications/state";
import { Button } from "@/components/ui/button";

type ClearNotificationsFormProps = {
  confirmationText: string;
  disabled: boolean;
};

export function ClearNotificationsForm({ confirmationText, disabled }: ClearNotificationsFormProps) {
  const [state, formAction, pending] = useActionState<AccountNotificationsActionState, FormData>(
    clearNotificationsAction,
    initialAccountNotificationsActionState
  );

  return (
    <div className="grid gap-2">
      <form action={formAction} className="flex flex-wrap gap-2">
        <input
          aria-label="Notification inbox clear confirmation"
          autoComplete="off"
          className="min-h-10 w-56 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          name="confirmation"
          placeholder={confirmationText}
          required
        />
        <Button disabled={disabled || pending} type="submit" variant="pink">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {pending ? "Clearing..." : "Clear inbox"}
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
