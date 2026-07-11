"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { adminPaymentsAction } from "@/app/admin/payments/actions";
import { initialAdminPaymentsActionState, type AdminPaymentsActionState } from "@/app/admin/payments/state";
import { Button } from "@/components/ui/button";

type WebhookRetryFormProps = {
  eventId: string;
};

export function WebhookRetryForm({ eventId }: WebhookRetryFormProps) {
  const [state, formAction, pending] = useActionState<AdminPaymentsActionState, FormData>(
    adminPaymentsAction,
    initialAdminPaymentsActionState
  );

  return (
    <form action={formAction} className="grid gap-3">
      <input name="intent" type="hidden" value="paypal-webhook-retry" />
      <input name="webhookEventId" type="hidden" value={eventId} />
      <Button disabled={pending} type="submit" variant="pink">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry webhook
      </Button>
      {state.message ? (
        <p className={`text-sm ${state.status === "error" ? "text-bc-pink" : "text-bc-acid"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
