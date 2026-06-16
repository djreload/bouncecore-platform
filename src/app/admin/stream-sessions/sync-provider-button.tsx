"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncStreamSessionsAction } from "@/app/admin/stream-sessions/actions";
import {
  initialAdminStreamSessionsActionState,
  type AdminStreamSessionsActionState
} from "@/app/admin/stream-sessions/state";

type SyncProviderButtonProps = {
  canSync: boolean;
};

export function SyncProviderButton({ canSync }: SyncProviderButtonProps) {
  const [state, formAction, pending] = useActionState<AdminStreamSessionsActionState, FormData>(
    syncStreamSessionsAction,
    initialAdminStreamSessionsActionState
  );

  if (!canSync) {
    return <p className="text-sm text-bc-muted">Read-only stream dashboard access.</p>;
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <form action={formAction}>
        <Button disabled={pending} type="submit" variant="ghost">
          <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          {pending ? "Syncing" : "Sync provider"}
        </Button>
      </form>
      {state.message ? (
        <p className={state.status === "error" ? "max-w-sm text-sm text-bc-pink" : "max-w-sm text-sm text-bc-muted"}>{state.message}</p>
      ) : null}
    </div>
  );
}
